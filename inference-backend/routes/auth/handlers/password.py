# src/routes/auth/handlers/password.py

import re
import datetime
from flask import request, jsonify, session, make_response
from werkzeug.security import generate_password_hash, check_password_hash

from jwt_helpers import jwt_required
from .. import auth_bp
from ..utils import verify_hcaptcha
from ..services import issue_tokens
from db.postgres_pool import pg_pool
from utils.cookies import set_refresh_cookie

# Only allow 3–30 characters, no slashes, question marks, hashes or whitespace
USERNAME_REGEX = re.compile(r'^[^\/\?#\s]{3,30}$')


def days_to_seconds(days: int) -> int:
    return days * 24 * 60 * 60


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    ---
    tags:
      - Authentication
    summary: Login with email and password
    """
    data = request.json or {}
    email          = data.get("email")
    password       = data.get("password")
    hcaptcha_token = data.get("hcaptcha_token")

    # Only require hCaptcha once per session
    if not session.get("captcha_verified", False):
        if not hcaptcha_token or not verify_hcaptcha(hcaptcha_token, request.remote_addr):
            return jsonify({"message": "hCaptcha check failed"}), 400
        session["captcha_verified"] = True
        session.permanent = True

    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, password_hash, username, google_sub, github_id, full_name, picture_url
            FROM users
            WHERE email = %s;
            """,
            (email,),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"message": "Invalid credentials"}), 401

        user_id, pw_hash, username, gsub, ghid, full_name, picture_url = row
        if not pw_hash or not check_password_hash(pw_hash, password):
            return jsonify({"message": "Invalid credentials"}), 401

        display_name = full_name or username
        avatar_url   = picture_url or ""

        # Issue tokens & persist RT
        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=username,
            google_linked=bool(gsub),
            github_linked=bool(ghid),
            has_password=True,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        conn.commit()

        payload = {
            "message":       "Login successful",
            "access_token":  tokens["access_token"],
            "user_id":       user_id,
            "username":      username,
            "display_name":  display_name,
            "avatar_url":    avatar_url,
            "google_linked": bool(gsub),
            "github_linked": bool(ghid),
            "has_password":  True,
        }

        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Login failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    ---
    tags:
      - Authentication
    summary: Register a new user
    """
    data = request.json or {}
    email          = data.get("email")
    password       = data.get("password")
    hcaptcha_token = data.get("hcaptcha_token")

    if not hcaptcha_token or not verify_hcaptcha(hcaptcha_token, request.remote_addr):
        return jsonify({"message": "hCaptcha check failed"}), 400
    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            return jsonify({"message": "User already exists"}), 409

        username = email.split("@")[0]
        pw_hash  = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (email, username, password_hash) VALUES (%s, %s, %s) RETURNING id;",
            (email, username, pw_hash),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"message": "Registration successful", "user_id": user_id}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Registration failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/set_password", methods=["POST"])
@jwt_required
def set_password():
    """
    ---
    tags:
      - Authentication
    summary: Set or change the user’s password
    """
    new_pw = (request.json or {}).get("new_password")
    if not new_pw:
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

        payload = {
            "message":      "Password set",
            "access_token": tokens["access_token"],
        }
        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Failed to set password", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/set_username", methods=["POST"])
@jwt_required
def set_username():
    """
    ---
    tags:
      - Authentication
    summary: Update the user’s username
    """
    new_name = (request.json or {}).get("username", "").strip()

    # Enforce our strict regex
    if not USERNAME_REGEX.match(new_name):
        return jsonify({
            "message": (
                "Invalid username: must be 3–30 characters and cannot include "
                "'/', '?', '#', or whitespace."
            )
        }), 400

    user_id = request.user["user_id"]
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET username = %s WHERE id = %s;", (new_name, user_id))
        if cur.rowcount != 1:
            conn.rollback()
            return jsonify({"message": "User not found"}), 404

        # Re-issue tokens with the new username
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

        payload = {
            "message":      "Username updated",
            "access_token": tokens["access_token"],
        }
        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Failed to update username", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)