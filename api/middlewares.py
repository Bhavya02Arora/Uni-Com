import os
import json
import requests
from functools import wraps
from flask import request, jsonify, current_app
import jwt
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import  DecodeError, ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError

# Set up the URL for the Cognito public keys
COGNITO_POOL_ID = os.getenv("COGNITO_POOL_ID")
COGNITO_REGION = os.getenv("COGNITO_REGION")
COGNITO_JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_POOL_ID}/.well-known/jwks.json"

# Fetch the JWKS keys from Cognito
def get_cognito_jwks():
    try:
        response = requests.get(COGNITO_JWKS_URL)
        return response.json()
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Error fetching JWKS: {e}")
        return None

# Get the public key from the JWKS based on the kid (key ID) in the token's header
def get_public_key(kid):
    jwks = get_cognito_jwks()
    if jwks is None:
        return None

    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return RSAAlgorithm.from_jwk(json.dumps(key))
    return None

# Middleware to verify the id_token
def verify_id_token(id_token):
    try:
        # Decode the JWT to get the header
        unverified_header = jwt.get_unverified_header(id_token)

        if unverified_header is None:
            raise ValueError("Invalid token header")

        # Get the public key from JWKS
        public_key = get_public_key(unverified_header["kid"])
        if public_key is None:
            raise ValueError("Unable to find appropriate public key")

        # Decode and verify the JWT using the public key
        payload = jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=os.getenv("COGNITO_APP_CLIENT_ID"),  # Ensure correct audience
            issuer=f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_POOL_ID}",
        )

        return payload  # Return the decoded payload if everything is valid

    except ExpiredSignatureError:
        raise ValueError("Token has expired")
    except DecodeError:
        raise ValueError("Error decoding token")
    except InvalidAudienceError:
        raise ValueError("Invalid audience - token does not match expected audience")
    except InvalidIssuerError:
        raise ValueError("Invalid issuer - token does not match expected issuer")
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")

# Flask middleware to check for id_token and verify it
def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"message": "Authorization header is missing"}), 401

        # Extract the token from the header (format: "Bearer <token>")
        token = auth_header.split(" ")[1] if len(auth_header.split(" ")) > 1 else None
        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            # Verify the token
            payload = verify_id_token(token)
            request.user_payload = payload  # Attach the payload to the request for further use
        except ValueError as e:
            return jsonify({"message": str(e)}), 401

        return f(*args, **kwargs)

    return decorated_function