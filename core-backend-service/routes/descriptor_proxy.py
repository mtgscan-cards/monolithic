from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin
import requests
import os
from utils.cors import get_cors_origin
from jwt_helpers import verify_token
from jwt_helpers import jwt_required

descriptor_proxy_bp = Blueprint("descriptor_proxy", __name__)
INFER_URL = os.getenv("INFERENCE_SERVICE_URL", "http://descriptor-infer-service:5001/infer")

@descriptor_proxy_bp.route("/infer", methods=["POST"])

@cross_origin(**get_cors_origin())
@jwt_required
def proxy_infer():
    # Manual JWT verification to avoid multipart/form-data stream issues
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        current_app.logger.warning("proxy_infer: Missing or invalid Authorization token")
        return jsonify({"message": "Missing or invalid Authorization token"}), 401

    try:
        request.user = verify_token(token)
    except Exception as e:
        current_app.logger.warning(f"proxy_infer: Token verification failed - {str(e)}")
        return jsonify({"message": "Invalid or expired token", "error": str(e)}), 401

    try:
        # Safe to access request.form and request.files now
        resp = requests.post(INFER_URL, files=request.files, data=request.form, timeout=10)
        return (resp.content, resp.status_code, resp.headers.items())
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Inference service error: {str(e)}")
        return jsonify({"error": f"Inference service error: {str(e)}"}), 502
