from datetime import datetime
from enum import Enum
from bson import ObjectId
from flask import current_app

# Enums for Post category and status
class PostCategory(Enum):
    ROOMMATE = "ROOMMATE"
    SELL = "SELL"
    CARPOOL = "CARPOOL"

class PostStatus(Enum):
    PUBLISHED = "PUBLISHED"
    CLOSED = "CLOSED"
    PROCESSING = "PROCESSING"
    FAILED = "FAILED"
    DELETED = "DELETED"

class SubCategory(Enum):
    BOOKS = "BOOKS"
    FURNITURE = "FURNITURE"
    ELECTRONICS = "ELECTRONICS"
    KITCHEN = "KITCHEN"
    OTHER = "OTHER"

class GenderPreference(Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    ANY = "ANY"

class UserStatus(Enum):
    ACTIVE = "ACTIVE"
    DELETED = "DELETED"

# MongoDB collections
def get_users_collection():
    db = current_app.config["MONGO_DB"]
    return db["users"]
def get_posts_collection():
    db = current_app.config["MONGO_DB"]
    return db["posts"]