# routes/auth/handlers/captcha.py

from flask import request, jsonify, session
from .. import auth_bp
from ..utils import verify_hcaptcha
from extensions import limiter

@auth_bp.route("/verify_captcha", methods=["POST"])
@limiter.limit("25 per minute; 100 per hour")
def verify_captcha():
    """
    ---
    tags:
      - Authentication
    summary: Verify hCaptcha token
    description: |
      Accepts an hCaptcha response token in the request body,
      verifies it against hCaptcha’s API, and on success marks
      the current session as captcha_verified.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            token:
              type: string
              description: hCaptcha response token from client
    responses:
      200:
        description: hCaptcha verified
        schema:
          type: object
          properties:
            message:
              type: string
              example: hCaptcha verified
      400:
        description: Verification failed
        schema:
          type: object
          properties:
            message:
              type: string
              example: hCaptcha verification failed
    """
    data = request.get_json() or {}
    token = data.get("token")
    if not token or not verify_hcaptcha(token, request.remote_addr):
        return jsonify({"message": "hCaptcha verification failed"}), 400
    session["captcha_verified"] = True
    return jsonify({"message": "hCaptcha verified"}), 200

@auth_bp.route("/captcha_status", methods=["GET"])
@limiter.limit("25 per minute; 100 per hour")
def captcha_status():
    """
    ---
    tags:
      - Authentication
    summary: Get hCaptcha verification status
    description: Returns whether the current session has already passed hCaptcha.
    responses:
      200:
        description: Current captcha verification status
        schema:
          type: object
          properties:
            captcha_verified:
              type: boolean
              example: true
    """
    verified = session.get("captcha_verified", False)
    return jsonify({"captcha_verified": verified}), 200