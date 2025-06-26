# src/routes/auth/handlers/password.py

import logging
import re
import datetime
from flask import request, jsonify, session, make_response, current_app
from flask_cors import cross_origin
from werkzeug.security import generate_password_hash, check_password_hash
from jwt_helpers import jwt_required
from .. import auth_bp
from ..utils import verify_hcaptcha
from ..services import issue_tokens
from db.postgres_pool import pg_pool
from utils.cookies import set_refresh_cookie
from jwt_helpers import create_access_token, create_refresh_token
from datetime import datetime, timedelta, timezone
from utils.cors import get_cors_origin
from flask_jwt_extended import set_access_cookies
from extensions import limiter


# Only allow 3–30 characters, no slashes, question marks, hashes or whitespace
USERNAME_REGEX = re.compile(r'^[^\/\?#\s]{3,30}$')


@auth_bp.route("/login", methods=["POST"])
@cross_origin(**get_cors_origin())
@limiter.limit("5 per minute; 25 per hour")
def login():
    """
    ---
    tags:
      - Authentication
    summary: Log in with email and password
    consumes:
      - application/json
    parameters:
      - in: body
        name: credentials
        required: true
        schema:
          type: object
          properties:
            email: { type: string, example: "user@example.com" }
            password: { type: string, example: "hunter2" }
            hcaptcha_token: { type: string, example: "10000000-aaaa-bbbb-cccc-000000000001" }
    responses:
      200: { description: Login successful }
      400: { description: Missing required fields }
      401: { description: Invalid credentials }
      500: { description: Server error }
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    logger = logging.getLogger(__name__)
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    hcaptcha_token = data.get("hcaptcha_token")

    logger.debug(f"Login attempt: email={email}, IP={request.remote_addr}")

    if not email or not password or not hcaptcha_token:
        logger.warning("Missing required login fields")
        return jsonify({"message": "Missing required fields"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, password_hash, username, display_name, avatar_url, google_linked, github_linked, has_password FROM users WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()

        if not row:
            logger.warning(f"Login failed: user not found for {email}")
            return jsonify({"message": "Invalid credentials"}), 401

        user_id, _, pw_hash, username, display_name, avatar_url, google_linked, github_linked, has_password = row

        if not check_password_hash(pw_hash, password):
            logger.warning(f"Login failed: incorrect password for {email}")
            return jsonify({"message": "Invalid credentials"}), 401

        payload = {
            "user_id": user_id,
            "username": username,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "google_linked": google_linked,
            "github_linked": github_linked,
            "has_password": has_password,
        }

        access_token  = create_access_token(payload)
        refresh_token = create_refresh_token(payload)
        expires_at    = datetime.now(timezone.utc) + timedelta(days=30)

        cur.execute(
            "INSERT INTO tokens (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (refresh_token, user_id, expires_at)
        )
        conn.commit()

        logger.info(f"✅ Login successful for user_id={user_id}, email={email}")

        resp = make_response(jsonify({
            "message":       "Login successful",
            "access_token":  access_token,
            "user_id":       user_id,
            "username":      username,
            "display_name":  display_name,
            "avatar_url":    avatar_url,
            "google_linked": google_linked,
            "github_linked": github_linked,
            "has_password":  has_password,
        }))
        set_access_cookies(resp, access_token)
        set_refresh_cookie(resp, refresh_token)
        return resp

    except Exception as exc:
        logger.exception(f"🔥 Login error for {email}: {exc}")
        return jsonify({"message": "Login failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/register", methods=["POST"])
@cross_origin(**get_cors_origin())
@limiter.limit("5 per minute; 25 per hour")
def register():
    """
    ---
    tags:
      - Authentication
    summary: Register a new user with email and password
    consumes:
      - application/json
    parameters:
      - in: body
        name: registration
        required: true
        schema:
          type: object
          properties:
            email: { type: string }
            password: { type: string }
            hcaptcha_token: { type: string }
    responses:
      201: { description: Registration successful }
      400: { description: Missing fields or invalid captcha }
      409: { description: User already exists }
      500: { description: Server error }
    """
    logger = logging.getLogger(__name__)
    data = request.json or {}
    email          = data.get("email")
    password       = data.get("password")
    hcaptcha_token = data.get("hcaptcha_token")

    logger.debug(f"Registration attempt: email={email}, IP={request.remote_addr}")

    if not hcaptcha_token or not verify_hcaptcha(hcaptcha_token, request.remote_addr):
        logger.warning("hCaptcha verification failed")
        return jsonify({"message": "hCaptcha check failed"}), 400
    if not email or not password:
        logger.warning("Missing email or password for registration")
        return jsonify({"message": "Email and password required"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            logger.warning(f"🛑 Registration failed: email already exists ({email})")
            return jsonify({"message": "User already exists"}), 409

        username = email.split("@")[0]
        pw_hash  = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (email, username, password_hash) VALUES (%s, %s, %s) RETURNING id;",
            (email, username, pw_hash),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        logger.info(f"✅ User registered: id={user_id}, email={email}")
        return jsonify({"message": "Registration successful", "user_id": user_id}), 201
    except Exception as exc:
        conn.rollback()
        logger.exception(f"🔥 Registration error for {email}: {exc}")
        return jsonify({"message": "Registration failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/set_password", methods=["POST"])
@cross_origin(**get_cors_origin())
@jwt_required
@limiter.limit("5 per minute; 25 per hour")
def set_password():
    """
    ---
    tags:
      - Authentication
    summary: Set or change the user’s password
    consumes:
      - application/json
    parameters:
      - in: body
        name: password
        required: true
        schema:
          type: object
          properties:
            new_password: { type: string }
    responses:
      200: { description: Password updated and tokens reissued }
      400: { description: Password missing }
      500: { description: Server error }
    """
    logger = logging.getLogger(__name__)
    new_pw = (request.json or {}).get("new_password")
    if not new_pw:
        logger.warning("Missing new_password field in set_password")
        return jsonify({"message": "new_password required"}), 400

    user_id = request.user["user_id"]
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s;",
            (generate_password_hash(new_pw), user_id),
        )
        conn.commit()

        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=request.user["username"],
            google_linked=request.user["google_linked"],
            github_linked=request.user["github_linked"],
            has_password=True,
            display_name=request.user["display_name"],
            avatar_url=request.user["avatar_url"],
        )

        logger.info(f"🔐 Password set for user_id={user_id}")

        payload = {
            "message":      "Password set",
            "access_token": tokens["access_token"],
        }
        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        logger.exception(f"🔥 Failed to set password for user_id={user_id}: {exc}")
        return jsonify({"message": "Failed to set password", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/set_username", methods=["POST"])
@jwt_required
@limiter.limit("5 per minute; 25 per hour")
def set_username():
    """
    ---
    tags:
      - Authentication
    summary: Update the user’s username
    consumes:
      - application/json
    parameters:
      - in: body
        name: update
        required: true
        schema:
          type: object
          properties:
            username: { type: string }
    responses:
      200: { description: Username updated }
      400: { description: Invalid username format }
      404: { description: User not found }
      500: { description: Server error }
    """
    logger = logging.getLogger(__name__)
    new_name = (request.json or {}).get("username", "").strip()

    if not USERNAME_REGEX.match(new_name):
        logger.warning(f"Invalid username format attempt: '{new_name}'")
        return jsonify({
            "message": (
                "Invalid username: must be 3–30 characters and cannot include "
                "'/', '?', '#', or whitespace."
            )
        }), 400

    user_id = request.user["user_id"]
    logger.debug(f"Username change attempt: user_id={user_id} → {new_name}")
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET username = %s WHERE id = %s;", (new_name, user_id))
        if cur.rowcount != 1:
            conn.rollback()
            logger.warning(f"🛑 Username update failed: user_id={user_id} not found")
            return jsonify({"message": "User not found"}), 404

        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=new_name,
            google_linked=request.user["google_linked"],
            github_linked=request.user["github_linked"],
            has_password=request.user["has_password"],
            display_name=request.user["display_name"],
            avatar_url=request.user["avatar_url"],
        )
        conn.commit()

        logger.info(f"✅ Username updated: user_id={user_id} → {new_name}")

        payload = {
            "message":      "Username updated",
            "access_token": tokens["access_token"],
        }
        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        logger.exception(f"🔥 Username update error for user_id={user_id}: {exc}")
        return jsonify({"message": "Failed to update username", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)
