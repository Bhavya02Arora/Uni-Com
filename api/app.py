import os
from dotenv import load_dotenv
from flask import Flask
from pymongo import MongoClient
from flasgger import Swagger

# Load environment variables
load_dotenv()

from utils import EMBEDDINGS_DIMENSIONS
from controllers import routes

# Initialize Flask app
app = Flask(__name__)
swagger = Swagger(app)

# Initialize MongoDB client with connection pooling
if bool(os.getenv("MONGO_USE_TLS", 'false') != 'false'):
    mongo_client = MongoClient(
        host=os.getenv("MONGO_HOST"),
        port=int(os.getenv("MONGO_PORT")),
        username=os.getenv("MONGO_USERNAME"),
        password=os.getenv("MONGO_PASSWORD"),
        authSource=os.getenv("MONGO_AUTH_SOURCE", "admin"),
        maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", 50)),
        minPoolSize=int(os.getenv("MONGO_MIN_POOL_SIZE", 5)),
        tls=bool(os.getenv("MONGO_USE_TLS", False)),
        tlsCAFile=os.getenv("MONGO_CA_FILE"),
        connect=True,
        retryWrites=False, # Disable retryWrites for compatibility with DocumentDB
        tlsAllowInvalidHostnames=bool(os.getenv("MONGO_TLS_ALLOW_INVALID_HOSTNAMES", True)),
        directConnection=True
    )
else:
    mongo_client = MongoClient(
        host=os.getenv("MONGO_HOST"),
        port=int(os.getenv("MONGO_PORT")),
        username=os.getenv("MONGO_USERNAME"),
        password=os.getenv("MONGO_PASSWORD"),
        authSource=os.getenv("MONGO_AUTH_SOURCE", "admin"),
        maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", 50)),
        minPoolSize=int(os.getenv("MONGO_MIN_POOL_SIZE", 5)),
        connect=True,
        retryWrites=False # Disable retryWrites for compatibility with some DocumentDB
    )

print(os.getenv("MONGO_HOST"))
# Check if the connection was successful
try:
    mongo_client.admin.command('ping')  # Ping the MongoDB server
    print("MongoDB connection successful")
except Exception as e:
    print("MongoDB connection failed:", e)
    raise RuntimeError("Failed to connect to MongoDB")

# Reference to database
mongo_db = mongo_client[os.getenv("MONGO_DB")]

# Pass mongo_db to routes
app.config["MONGO_DB"] = mongo_db

def ensure_description_vector_index():
    collection = app.config["MONGO_DB"]["posts"]

    existing_indexes = collection.index_information()
    index_name = "description_vector_hnsw"

    if index_name in existing_indexes:
        print(f"Vector index '{index_name}' already exists.")
        return
        # collection.drop_index(index_name)
        # print(f"Dropped existing vector index '{index_name}'.")

    print(f"Creating vector index '{index_name}'...")

    try:
        collection.create_index ([("description_vector","vector")], 
            vectorOptions= {
                "type": "hnsw", #You can choose HNSW index as well. With HNSW, you will have to remove "lists" parameter and use "m" and "efConstruction".
                "similarity": "cosine",
                "dimensions": EMBEDDINGS_DIMENSIONS,
                "m": 16,
                "efConstruction": 200},
            name="description_vector_hnsw")
        print("Vector index created successfully.")
    except Exception as e:
        print("Failed to create vector index:", e)

ensure_description_vector_index()
# Register routes blueprint
app.register_blueprint(routes)

if __name__ == '__main__':
    app.run(debug=True, port=os.getenv("FLASK_PORT", 8080), host='0.0.0.0')  # Use the port from environment variable or default to 5000