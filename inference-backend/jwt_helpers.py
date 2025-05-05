# jwt_helpers.py

from __future__ import annotations
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app

# lifetimes…
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS   = 30

def create_access_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.datetime.utcnow() + datetime.timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    secret    = current_app.config['JWT_SECRET_KEY']
    algorithm = current_app.config.get('JWT_ALGORITHM', 'HS256')
    return jwt.encode(data, secret, algorithm=algorithm)

def create_refresh_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.datetime.utcnow() + datetime.timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )
    secret    = current_app.config['JWT_SECRET_KEY']
    algorithm = current_app.config.get('JWT_ALGORITHM', 'HS256')
    return jwt.encode(data, secret, algorithm=algorithm)

def verify_token(token: str) -> dict:
    secret    = current_app.config['JWT_SECRET_KEY']
    algorithm = current_app.config.get('JWT_ALGORITHM', 'HS256')
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError as e:
        raise Exception("Token expired") from e
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {e}") from e

def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"message": "Missing or invalid Authorization header"}), 401
        token = header.split(" ", 1)[1]
        try:
            request.user = verify_token(token)
        except Exception as e:
            return jsonify({"message": "Invalid or expired token", "error": str(e)}), 401
        return f(*args, **kwargs)
    return wrapper