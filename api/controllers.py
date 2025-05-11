import os
import base64
import numpy as np
from models import *
from bson import ObjectId
from threading import Thread
from middlewares import jwt_required
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from utils import process_image, process_text, store_image_in_s3
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from utils import get_embeddings, EMBEDDINGS_DIMENSIONS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

routes = Blueprint("routes", __name__)

CLOUDFRONT_URL = os.getenv("CLOUDFRONT_URL")
KEY_PAIR_ID = os.getenv("CLOUDFRONT_KEY_PAIR_ID")
PRIVATE_KEY_PATH = os.getenv("CLOUDFRONT_PRIVATE_KEY_PATH")

SCORE_THRESHOLD = float(os.getenv("SCORE_THRESHOLD", 0.80))
TOP_K = int(os.getenv("TOP_K", 5))  # Default to 5 if not set

@routes.route("/api/users", methods=["POST"])
@jwt_required
def create_user():
    """
    Create or reactivate a user.
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: User created or reactivated
      400:
        description: Missing or invalid email in token
    """
    users = get_users_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    # Check if user already exists
    existing_user = users.find_one({"email": user_email})
    if existing_user:
        if existing_user.get("status") == UserStatus.DELETED.value:
            users.update_one(
                {"_id": existing_user["_id"]},
                {"$set": {"status": UserStatus.ACTIVE.value}},
            )
            existing_user["status"] = UserStatus.ACTIVE.value

        existing_user["_id"] = str(existing_user["_id"])
        return jsonify(existing_user), 200

    # Create new user
    user_data = {
        "email": user_email,
        "name": user_payload.get("name"),  # <-- added name
        "college": user_payload.get("college"),
        "department": user_payload.get("department"),
        "created_at": datetime.now(timezone.utc),
        "status": UserStatus.ACTIVE.value,
    }

    result = users.insert_one(user_data)
    new_user = users.find_one({"_id": result.inserted_id})
    new_user["_id"] = str(new_user["_id"])

    return jsonify(new_user), 200


@routes.route("/api/users", methods=["PATCH"])
@jwt_required
def update_user():
    """
    Update user details (college and/or department).
    ---
    tags:
      - Users
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        schema:
          properties:
            name:
              type: string
            college:
              type: string
            department:
              type: string
    responses:
      200:
        description: User updated
      400:
        description: No fields provided or update failed
      404:
        description: User not found
    """
    users = get_users_collection()

    # Check if the user exists (by the email in the token)
    user_payload = request.user_payload
    user_email = user_payload.get("email")
    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    # Fetch the existing user from MongoDB
    existing_user = users.find_one({"email": user_email})
    if not existing_user:
        return jsonify({"error": "User not found or unauthorized"}), 404

    # Get the update data (name, college and department)
    data = request.json
    name = data.get("name")
    college = data.get("college")
    department = data.get("department")

    # Validate the update fields (college and department)
    if not college and not department and not name:
        return (
            jsonify(
                {
                    "error": "At least one of 'college' or 'department' or 'name' must be provided"
                }
            ),
            400,
        )

    # Prepare the update data
    update_fields = {}
    if name:
        update_fields["name"] = name
    if college:
        update_fields["college"] = college
    if department:
        update_fields["department"] = department

    # Update the user in the database
    result = users.update_one(
        {"_id": existing_user["_id"], "email": user_email},  # Find by ID and email
        {"$set": update_fields},  # Update the specified fields
    )

    if result.modified_count == 0:
        return jsonify({"error": "No changes were made"}), 400

    # Fetch the updated user
    updated_user = users.find_one({"_id": existing_user["_id"], "email": user_email})
    updated_user["_id"] = str(
        updated_user["_id"]
    )  # Convert the ObjectId to string for the response

    # Return the updated user
    return jsonify(updated_user), 200


@routes.route("/api/users/<string:email>", methods=["GET"])
@jwt_required
def get_user(email):
    """
    Fetch a user by their email.
    ---
    tags:
      - Users
    security:
      - Bearer: []
    parameters:
      - name: email
        in: path
        type: string
        required: true
    responses:
      200:
        description: User data returned
      404:
        description: User not found
    """
    users = get_users_collection()

    # Check if the user exists by email
    user = users.find_one({"email": email})

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Convert ObjectId to string for the response
    user["_id"] = str(user["_id"])

    return jsonify(user), 200


def async_moderate_post(post_id, post_data, images, posts):
    try:
        # Step 1: Validate number of images
        if images and len(images) > 5:
            posts.update_one(
                {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
            )
            return

        image_bytes_list = []

        # Step 2: Decode and moderate all images
        if images:
            for i, image_data in enumerate(images):
                try:
                    image_bytes = base64.b64decode(image_data)
                except Exception as e:
                    logger.error(f"Base64 decoding failed for image {i+1}: {e}")
                    posts.update_one(
                        {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
                    )
                    return

                if not process_image(image_bytes):
                    logger.error(f"Image {i+1} failed moderation")
                    posts.update_one(
                        {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
                    )
                    return

                image_bytes_list.append(image_bytes)  # Store for later S3 upload

        # Step 3: Moderate the text
        if not process_text(post_data["description"]):
            logger.error("Text moderation failed")
            posts.update_one(
                {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
            )
            return

        # Step 4: Store images in S3 *only after* all moderation passes
        image_urls = []
        for i, image_bytes in enumerate(image_bytes_list):
            image_name = f"published/post_{str(post_id)}/image_{i+1}.jpg"
            image_url = store_image_in_s3(image_bytes, image_name)
            if not image_url:
                logger.error(f"Image {i+1} failed to upload to S3")
                posts.update_one(
                    {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
                )
                return
            image_urls.append(image_url)

        # Step 5: Update status and image URLs
        update_data = {"status": PostStatus.PUBLISHED.value}
        if image_urls:
            update_data["image_url"] = image_urls  # Store multiple

        try:
            # Generate embedding and attach to the same document
            embedding = get_embeddings(post_data["description"])
            update_data["description_vector"] = embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            posts.update_one(
                {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
            )
            return

        posts.update_one({"_id": post_id}, {"$set": update_data})

    except Exception as e:
        logger.error(f"Moderation error: {e}")
        posts.update_one(
            {"_id": post_id}, {"$set": {"status": PostStatus.FAILED.value}}
        )


@routes.route("/api/posts", methods=["POST"])
@jwt_required
def create_post():
    """
    Create a new post and trigger moderation.
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            category:
              type: string
            title:
              type: string
            description:
              type: string
            images:
              type: array
              items:
                type: string
    responses:
      202:
        description: Post created and under moderation
      400:
        description: Missing fields or invalid input
    """
    posts = get_posts_collection()
    data = request.json
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    # Validate required fields
    for field in ["category", "title", "description"]:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400

    post_category = data.get("category")
    post_data = {
        "owner": user_email,
        "category": post_category,
        "title": data["title"],
        "description": data["description"],
        "status": PostStatus.PROCESSING.value,
        "created_at": datetime.now(timezone.utc),
    }
    # Additional category-specific validation
    if post_category == PostCategory.ROOMMATE.value:
        for field in ["community", "rent", "start_date"]:
            if field not in data:
                return (
                    jsonify(
                        {"error": f"{field} is required for category {post_category}"}
                    ),
                    400,
                )
        start_date_obj = datetime.fromisoformat(data["start_date"])
        post_data.update(
            {
                "community": data["community"],
                "rent": float(data["rent"]),
                "start_date": start_date_obj,
            }
        )
        formatted_start_date = start_date_obj.strftime("%B %d, %Y")
        gender_preference = data.get("gender_preference")
        if gender_preference not in [gender.value for gender in GenderPreference]:
            gender_preference = GenderPreference.ANY.value
        post_data["gender_preference"] = gender_preference

        # Prepare preferences text
        preferences = data.get("preferences", [])
        post_data["preferences"] = preferences
        preferences_str = ", ".join(preferences) if preferences else "None"

        # Append to description
        post_data["description"] = (
            f"Community: {data['community']} | Preference: {gender_preference} | Preferences: {preferences_str}. "
            f"Available from {formatted_start_date}. {data['description']}"
        )

    elif post_category == PostCategory.SELL.value:
        for field in ["price", "item"]:
            if field not in data:
                return (
                    jsonify(
                        {"error": f"{field} is required for category {post_category}"}
                    ),
                    400,
                )
        post_data.update(
            {
                "price": float(data["price"]),  # Assuming price is a float
                "item": data["item"],
            }
        )
        sub_category = data.get("sub_category")
        if sub_category not in [sub.value for sub in SubCategory]:
            sub_category = SubCategory.OTHER.value  # Default to OTHER if not provided
        post_data["sub_category"] = sub_category

    elif post_category == PostCategory.CARPOOL.value:
        for field in ["from_location", "to_location", "departure_time"]:
            if field not in data:
                return (
                    jsonify(
                        {"error": f"{field} is required for category {post_category}"}
                    ),
                    400,
                )

        from_location = data["from_location"]
        to_location = data["to_location"]
        departure_time = datetime.fromisoformat(data["departure_time"])

        post_data.update(
            {
                "from_location": from_location,
                "to_location": to_location,
                "departure_time": departure_time,
                "seats_available": int(data.get("seats_available", 1)),
            }
        )

        # Append to description
        formatted_time = departure_time.strftime(
            "%B %d, %Y at %I:%M %p"
        )  # e.g., April 20, 2025 at 08:30 AM
        post_data["description"] = (
            f"From {from_location} to {to_location} on {formatted_time}. {data['description']}"
        )

    else:
        return jsonify({"error": "Invalid post category provided"}), 400

    post_data["description_vector"] = [0.0] * EMBEDDINGS_DIMENSIONS  # Placeholder for embedding
    # Insert into DB with PROCESSING status
    post = posts.insert_one(post_data)

    # Kick off background moderation
    images = data.get("images", [])
    Thread(
        target=async_moderate_post, args=(post.inserted_id, post_data, images, posts)
    ).start()

    # Return immediately
    return (
        jsonify(
            {
                "message": "Post submitted and is under moderation",
                "post_id": str(post.inserted_id),
                "status": PostStatus.PROCESSING.value,
            }
        ),
        202,
    )


@routes.route("/api/posts/<string:id>", methods=["GET"])
@jwt_required
def get_post(id):
    """
    Get a post by its ID.
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Post returned
      400:
        description: Invalid post ID
      403:
        description: Unauthorized to view this post
      404:
        description: Post not found
    """
    posts = get_posts_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    try:
        post = posts.find_one({"_id": ObjectId(id)}, {"description_vector": 0})
    except Exception as e:
        return jsonify({"error": "Invalid post ID format"}), 400

    if not post:
        return jsonify({"error": "Post not found"}), 404

    post_status = post.get("status")
    post_owner = post.get("owner")

    if post_status == PostStatus.DELETED.value:
        return jsonify({"error": "Post not found"}), 404

    if post_status != PostStatus.PUBLISHED.value and post_owner != user_email:
        return jsonify({"error": "You are not authorized to view this post"}), 403

    # Convert ObjectId to string for JSON response
    post["_id"] = str(post["_id"])
    return jsonify(post), 200


@routes.route("/api/posts/<string:id>", methods=["DELETE"])
@jwt_required
def delete_post(id):
    """
    Soft delete a post (owner-only).
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Post marked as deleted
      400:
        description: Invalid post ID
      403:
        description: Unauthorized to delete this post
      404:
        description: Post not found
    """
    posts = get_posts_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    try:
        post = posts.find_one({"_id": ObjectId(id)})
    except Exception:
        return jsonify({"error": "Invalid post ID format"}), 400

    if not post:
        return jsonify({"error": "Post not found"}), 404

    if post.get("owner") != user_email:
        return jsonify({"error": "You are not authorized to delete this post"}), 403

    posts.update_one(
        {"_id": ObjectId(id)}, {"$set": {"status": PostStatus.DELETED.value}}
    )

    return jsonify({"message": "Post marked as deleted"}), 200


@routes.route("/api/posts/<string:id>", methods=["PATCH"])
@jwt_required
def update_post(id):
    """
    Update a post's status (PUBLISHED or CLOSED only).
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: id
        in: path
        type: string
        required: true
      - name: body
        in: body
        schema:
          properties:
            status:
              type: string
    responses:
      200:
        description: Post status updated
      400:
        description: Invalid status or update disallowed
      403:
        description: Unauthorized
      404:
        description: Post not found
    """
    posts = get_posts_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    try:
        post = posts.find_one({"_id": ObjectId(id)})
    except Exception:
        return jsonify({"error": "Invalid post ID format"}), 400

    if not post:
        return jsonify({"error": "Post not found"}), 404

    if post.get("owner") != user_email:
        return jsonify({"error": "You are not authorized to update this post"}), 403

    immutable_statuses = {
        PostStatus.DELETED.value,  # Assuming DELETED is a final state
        PostStatus.FAILED.value,  # Posts in FAILED status cannot be updated
        PostStatus.PROCESSING.value,  # Posts in PROCESSING status cannot be updated
    }

    if post.get("status") in immutable_statuses:
        return jsonify({"error": "Post in current status cannot be updated"}), 400

    data = request.json
    new_status = data.get("status")

    if not new_status:
        return jsonify({"error": "Missing 'status' field in request body"}), 400

    allowed_statuses = {PostStatus.PUBLISHED.value, PostStatus.CLOSED.value}

    if new_status not in allowed_statuses:
        return (
            jsonify(
                {
                    "error": f"Invalid status. Allowed values: {', '.join(allowed_statuses)}"
                }
            ),
            400,
        )

    posts.update_one({"_id": ObjectId(id)}, {"$set": {"status": new_status}})

    return jsonify({"message": f"Post status updated to {new_status}"}), 200


@routes.route("/api/myposts", methods=["GET"])
@jwt_required
def get_my_posts():
    """
    Fetch current user's posts with filters and pagination.
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: status
        in: query
        type: string
      - name: category
        in: query
        type: string
      - name: search
        in: query
        type: string
      - name: sort
        in: query
        type: string
        enum: [asc, desc]
      - name: page
        in: query
        type: integer
      - name: limit
        in: query
        type: integer
    responses:
      200:
        description: List of user's posts
      400:
        description: Invalid pagination parameters
    """
    posts = get_posts_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    # Query params
    status = request.args.get("status")
    category = request.args.get("category")
    search = request.args.get("search", "").strip()
    sort_order = request.args.get("sort", "desc").lower()  # "asc" or "desc"
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))

    if page < 1 or limit < 1:
        return jsonify({"error": "Page and limit must be positive integers"}), 400

    query = {"owner": user_email, "status": {"$ne": PostStatus.DELETED.value}}

    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    sort = [("created_at", 1 if sort_order == "asc" else -1)]
    skip = (page - 1) * limit

    cursor = (
        posts.find(query, {"description_vector": 0}).sort(sort).skip(skip).limit(limit)
    )
    total = posts.count_documents(query)

    results = []
    for post in cursor:
        post["_id"] = str(post["_id"])
        results.append(post)

    return (
        jsonify({"posts": results, "page": page, "limit": limit, "total": total}),
        200,
    )


def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    if np.linalg.norm(vec1) == 0 or np.linalg.norm(vec2) == 0:
        return 0.0
    return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))


@routes.route("/api/posts/semanticsearch", methods=["POST"])
@jwt_required
def semantic_search_posts():
    data = request.json
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400

    query_embedding = get_embeddings(query)
    similarity_threshold = SCORE_THRESHOLD

    posts = get_posts_collection()

    # Fetch top-k candidates with vector search
    raw_results = posts.aggregate(
        [
            {
                "$search": {
                    "vectorSearch": {
                        "path": "description_vector",
                        "vector": query_embedding,
                        "k": TOP_K,
                        "similarity": "cosine",
                    }
                }
            },
            {"$match": {"status": PostStatus.PUBLISHED.value}},
            {
                "$project": {
                    "_id": {"$toString": "$_id"},
                    "title": 1,
                    "description": 1,
                    "category": 1,
                    "owner": 1,
                    "status": 1,
                    "created_at": 1,
                    "image_url": 1,
                    "sub_category": 1,
                    "community": 1,
                    "rent": 1,
                    "start_date": 1,
                    "gender_preference": 1,
                    "item": 1,
                    "price": 1,
                    "from_location": 1,
                    "to_location": 1,
                    "departure_time": 1,
                    "seats_available": 1,
                    "description_vector": 1,
                }
            },
        ]
    )

    filtered_results = []
    for post in raw_results:
        post_vec = post.get("description_vector")
        if not post_vec:
            continue
        score = cosine_similarity(query_embedding, post_vec)
        if score >= similarity_threshold:
            post["_id"] = str(post["_id"])
            post["score"] = score  # Optional: include score in response
            filtered_results.append(post)

    # Optionally sort by similarity score
    filtered_results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify(filtered_results), 200


@routes.route("/api/myposts/semanticsearch", methods=["POST"])
@jwt_required
def semantic_search_my_posts():
    """
    Semantic search within current user's posts.
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            query:
              type: string
              description: The search query for semantic similarity
              example: "room near downtown with parking"
    responses:
      200:
        description: List of matching user posts
      400:
        description: Query missing or invalid
    """
    posts = get_posts_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    data = request.json
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400

    query_embedding = get_embeddings(query)

    # Vector search and filter to user-owned posts
    raw_results = posts.aggregate(
        [
            {
                "$search": {
                    "vectorSearch": {
                        "path": "description_vector",
                        "vector": query_embedding,
                        "k": TOP_K,
                        "similarity": "cosine",
                    }
                }
            },
            {
                "$match": {
                    "owner": user_email,
                    "status": {"$ne": PostStatus.DELETED.value},
                }
            },
            {
                "$project": {
                    "_id": {"$toString": "$_id"},
                    "title": 1,
                    "description": 1,
                    "category": 1,
                    "owner": 1,
                    "status": 1,
                    "created_at": 1,
                    "image_url": 1,
                    "sub_category": 1,
                    "community": 1,
                    "rent": 1,
                    "start_date": 1,
                    "gender_preference": 1,
                    "item": 1,
                    "price": 1,
                    "from_location": 1,
                    "to_location": 1,
                    "departure_time": 1,
                    "seats_available": 1,
                    "description_vector": 1,
                }
            },
        ]
    )

    # Compute score and filter by threshold
    filtered_results = []
    for post in raw_results:
        post_vec = post.get("description_vector")
        if not post_vec:
            continue
        score = cosine_similarity(query_embedding, post_vec)
        if score >= SCORE_THRESHOLD:
            post["score"] = score
            filtered_results.append(post)

    filtered_results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify(filtered_results), 200


@routes.route("/api/posts", methods=["GET"])
@jwt_required
def get_posts():
    """
    Fetch all published posts with filters, search, pagination.
    ---
    tags:
      - Posts
    security:
      - Bearer: []
    parameters:
      - name: category
        in: query
        type: string
      - name: search
        in: query
        type: string
      - name: sort
        in: query
        type: string
        enum: [asc, desc]
      - name: page
        in: query
        type: integer
      - name: limit
        in: query
        type: integer
    responses:
      200:
        description: List of posts
      400:
        description: Invalid pagination parameters
    """
    posts = get_posts_collection()

    # Query params
    category = request.args.get("category")
    search = request.args.get("search", "").strip()
    sort_order = request.args.get("sort", "desc").lower()  # "asc" or "desc"
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))

    if page < 1 or limit < 1:
        return jsonify({"error": "Page and limit must be positive integers"}), 400

    query = {"status": PostStatus.PUBLISHED.value}

    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    sort = [("created_at", 1 if sort_order == "asc" else -1)]
    skip = (page - 1) * limit

    cursor = (
        posts.find(query, {"description_vector": 0}).sort(sort).skip(skip).limit(limit)
    )
    total = posts.count_documents(query)

    results = []
    for post in cursor:
        post["_id"] = str(post["_id"])
        results.append(post)

    return (
        jsonify({"posts": results, "page": page, "limit": limit, "total": total}),
        200,
    )


def rsa_signer(message):
    with open(PRIVATE_KEY_PATH, "rb") as key_file:
        private_key = serialization.load_pem_private_key(key_file.read(), password=None)
        signature = private_key.sign(
            message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA1()
        )
        return base64.b64encode(signature).decode("utf-8")


@routes.route("/api/signedcookie", methods=["GET"])
@jwt_required
def get_signed_cookie():
    """
    Generate CloudFront signed cookies for post images.
    ---
    tags:
      - Media
    security:
      - Bearer: []
    responses:
      200:
        description: Signed cookies returned
    """
    # Allow access to all post images for 1 hour
    expires = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
    policy = f"""{{
      "Statement": [
        {{
          "Resource": "{CLOUDFRONT_URL}published/**",
          "Condition": {{
            "DateLessThan": {{
              "AWS:EpochTime": {expires}
            }}
          }}
        }}
      ]
    }}"""

    # Sign the policy
    signature = rsa_signer(policy)

    return (
        jsonify(
            {
                "CloudFront-Policy": base64.b64encode(policy.encode("utf-8")).decode(
                    "utf-8"
                ),
                "CloudFront-Signature": signature,
                "CloudFront-Key-Pair-Id": KEY_PAIR_ID,
                "expires": expires,
            }
        ),
        200,
    )


@routes.route("/api/signedurl", methods=["GET"])
@jwt_required
def get_signed_url():
    """
    Generate CloudFront signed URL components for post images (whole published folder).
    ---
    tags:
      - Media
    security:
      - Bearer: []
    responses:
      200:
        description: Signed URL parameters returned
    """
    expires = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())

    policy = f"""{{
      "Statement": [
        {{
          "Resource": "{CLOUDFRONT_URL}published/*",
          "Condition": {{
            "DateLessThan": {{
              "AWS:EpochTime": {expires}
            }}
          }}
        }}
      ]
    }}"""

    # Sign the policy
    signature = rsa_signer(policy)

    return (
        jsonify(
            {
                "CloudFront-Policy": base64.b64encode(policy.encode("utf-8")).decode(
                    "utf-8"
                ),
                "CloudFront-Signature": signature,
                "CloudFront-Key-Pair-Id": KEY_PAIR_ID,
                "expires": expires,
            }
        ),
        200,
    )


@routes.route("/api/users/me", methods=["DELETE"])
@jwt_required
def delete_current_user():
    """
    Soft delete current user and all their posts.
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: User and posts deleted
      404:
        description: User not found
    """
    posts = get_posts_collection()
    users = get_users_collection()
    user_payload = request.user_payload
    user_email = user_payload.get("email")

    if not user_email:
        return jsonify({"error": "User email not found in token"}), 400

    user = users.find_one({"email": user_email})

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Soft-delete posts
    posts.update_many(
        {"owner": user_email}, {"$set": {"status": PostStatus.DELETED.value}}
    )

    # Soft-delete user
    users.update_one({"email": user_email}, {"$set": {"status": "DELETED"}})

    return jsonify({"message": "Your account and posts have been deleted"}), 200


@routes.route("/health", methods=["GET"])
def health_check():
    """
    Health check endpoint.
    ---
    tags:
      - System
    responses:
      200:
        description: API is running
    """
    return jsonify({"status": "ok", "message": "API is running"}), 200
