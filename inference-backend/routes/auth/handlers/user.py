# routes/auth/handlers/user.py

from flask import jsonify, request
from jwt_helpers import jwt_required
from .. import auth_bp
from db.postgres_pool import pg_pool

@auth_bp.route("/me", methods=["GET"])
@jwt_required
def me():
    """
    ---
    tags:
      - Authentication
    summary: Get current user profile
    description: |
      Returns profile information for the authenticated user,
      including display name, avatar URL, and linked account flags.
    parameters:
      - in: header
        name: Authorization
        required: true
        type: string
        description: Bearer access token
    responses:
      200:
        description: User profile returned successfully
        schema:
          type: object
          properties:
            display_name:
              type: string
            avatar_url:
              type: string
            google_linked:
              type: boolean
            github_linked:
              type: boolean
            has_password:
              type: boolean
            username:
              type: string
      401:
        description: Missing or invalid token
        schema:
          type: object
          properties:
            message:
              type: string
    """
    user_id = request.user["user_id"]
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              COALESCE(full_name, username)    AS display_name,
              COALESCE(picture_url, '')         AS avatar_url,
              (google_sub IS NOT NULL)         AS google_linked,
              (github_id IS NOT NULL)          AS github_linked,
              (password_hash IS NOT NULL)      AS has_password,
              username
            FROM users
            WHERE id = %s;
            """,
            (user_id,),
        )
        display_name, avatar_url, google_linked, github_linked, has_password, username = cur.fetchone()

        return jsonify({
            "display_name":  display_name,
            "avatar_url":    avatar_url,
            "google_linked": google_linked,
            "github_linked": github_linked,
            "has_password":  has_password,
            "username":      username,
        }), 200
    finally:
        pg_pool.putconn(conn)

@auth_bp.route("/username_available", methods=["GET"])
def username_available():
    """
    ---
    tags:
      - Authentication
    summary: Check username availability
    description: |
      Determines if a given username is available for registration.
      Rejects strings shorter than 3 characters or containing '@'.
    parameters:
      - in: query
        name: username
        required: true
        type: string
        description: The username to check
    responses:
      200:
        description: Availability result
        schema:
          type: object
          properties:
            available:
              type: boolean
              example: true
    """
    raw = request.args.get("username", "").strip()
    # too short or looks like an email → never available
    if len(raw) < 3 or "@" in raw:
        return jsonify({"available": False}), 200

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM users WHERE LOWER(username) = LOWER(%s) LIMIT 1;",
            (raw,),
        )
        taken = cur.fetchone() is not None
        return jsonify({"available": not taken}), 200
    finally:
        pg_pool.putconn(conn)
