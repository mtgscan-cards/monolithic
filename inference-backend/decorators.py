# decorators.py
from functools import wraps
from flask import request, jsonify
from jwt_helpers import verify_token  # Make sure jwt_helpers.py exists and is accessible

def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        if not auth_header:
            return jsonify({"message": "Authorization header missing"}), 401
        try:
            token = auth_header.split(" ")[1]
            payload = verify_token(token)
            request.user = payload  # Attach user info to the request
        except Exception as e:
            return jsonify({"message": "Invalid or expired token", "error": str(e)}), 401
        return f(*args, **kwargs)
    return decorated_function
