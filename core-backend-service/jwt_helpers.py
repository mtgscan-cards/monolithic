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

import logging
logger = logging.getLogger(__name__)

def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            token = None
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]

            if not token:
                token = request.cookies.get("access_token")

            if not token:
                current_app.logger.warning("jwt_required: no token in header or cookie")
                return jsonify({"message": "Missing or invalid Authorization token"}), 401

            request.user = verify_token(token)
            return f(*args, **kwargs)

        except Exception as e:
            current_app.logger.warning(f"jwt_required: token error: {str(e)}")
            return jsonify({"message": "Invalid or expired token", "error": str(e)}), 401

    return wrapper