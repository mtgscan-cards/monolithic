from flask import redirect, request, jsonify, session, make_response, current_app
import urllib

from flask_cors import cross_origin
from jwt_helpers import jwt_required
from .. import auth_bp
from ..utils import verify_google_token
from ..services import issue_tokens
from db.postgres_pool import pg_pool
from utils.cookies import set_refresh_cookie
from config import FRONTEND_URL
from utils.cors import get_cors_origin

@auth_bp.route("/login/google", methods=["POST", "OPTIONS"])
@cross_origin(**get_cors_origin())
def google_login():
    """
    ---
    tags:
      - Authentication
    summary: Log in using Google OAuth credential
    consumes:
      - application/json
    parameters:
      - name: credential
        in: body
        required: true
        schema:
          type: object
          properties:
            credential:
              type: string
              example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
    responses:
      200:
        description: Access and refresh tokens issued
        schema:
          type: object
          properties:
            access_token: { type: string }
            username: { type: string }
            display_name: { type: string }
            avatar_url: { type: string }
            google_linked: { type: boolean }
            github_linked: { type: boolean }
            has_password: { type: boolean }
      400:
        description: Missing or invalid credential
      500:
        description: Server error
    """
    cred = (request.json or {}).get("credential")
    if not cred:
        return jsonify({"message": "credential missing"}), 400

    try:
        payload = verify_google_token(cred)
        session.permanent = True
    except Exception as exc:
        return jsonify({"message": "Invalid Google token", "error": str(exc)}), 400

    google_sub = payload["sub"]
    email      = payload.get("email")
    full_name  = payload.get("name")
    picture    = payload.get("picture")
    locale     = payload.get("locale")

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, username, password_hash FROM users WHERE google_sub = %s;", (google_sub,))
        row = cur.fetchone()

        if row:
            user_id, username, pw_hash = row
            cur.execute("UPDATE users SET email = %s, full_name = %s, picture_url = %s, locale = %s WHERE id = %s;",
                        (email, full_name, picture, locale, user_id))
        else:
            cur.execute("SELECT id, username, password_hash FROM users WHERE email = %s;", (email,))
            row2 = cur.fetchone()
            if row2:
                user_id, username, pw_hash = row2
                cur.execute("UPDATE users SET google_sub = %s, full_name = %s, picture_url = %s, locale = %s WHERE id = %s;",
                            (google_sub, full_name, picture, locale, user_id))
            else:
                username = email.split("@")[0]
                cur.execute("INSERT INTO users (email, username, google_sub, full_name, picture_url, locale) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;",
                            (email, username, google_sub, full_name, picture, locale))
                user_id = cur.fetchone()[0]
                pw_hash = None

        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=username,
            google_linked=True,
            github_linked=False,
            has_password=bool(pw_hash),
            display_name=full_name or username,
            avatar_url=picture or "",
        )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Auth error", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

    resp = jsonify({
        "access_token":  tokens["access_token"],
        "username":      username,
        "display_name":  full_name or username,
        "avatar_url":    picture or "",
        "google_linked": True,
        "github_linked": False,
        "has_password":  bool(pw_hash),
    })
    set_refresh_cookie(resp, tokens["refresh_token"])
    return resp


@auth_bp.route("/link/google", methods=["POST"])
@cross_origin(**get_cors_origin())
@jwt_required
def link_google():
    """
    ---
    tags:
      - Authentication
    summary: Link a Google account to the currently authenticated user
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            credential:
              type: string
              example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
    responses:
      200:
        description: Account successfully linked and tokens returned
        schema:
          type: object
          properties:
            access_token: { type: string }
            username: { type: string }
            display_name: { type: string }
            avatar_url: { type: string }
            google_linked: { type: boolean }
            github_linked: { type: boolean }
            has_password: { type: boolean }
      400:
        description: Invalid or missing credential
      409:
        description: Google account already linked to another user
      500:
        description: Server error
    """
    cred = (request.json or {}).get("credential")
    if not cred:
        return jsonify({"message": "credential missing"}), 400

    try:
        payload = verify_google_token(cred)
    except Exception as exc:
        return jsonify({"message": "Invalid Google token", "error": str(exc)}), 400

    google_sub = payload["sub"]
    full_name  = payload.get("name")
    picture    = payload.get("picture")
    locale     = payload.get("locale")
    email      = payload.get("email")

    user_id    = request.user["user_id"]

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE google_sub = %s;", (google_sub,))
        if cur.fetchone():
            return jsonify({"message": "Google account already linked"}), 409

        cur.execute(
            """
            UPDATE users
               SET google_sub   = %s,
                   full_name    = %s,
                   picture_url  = %s,
                   email        = %s,
                   locale       = %s
             WHERE id = %s;
            """,
            (google_sub, full_name, picture, email, locale, user_id),
        )

        cur.execute("SELECT username, password_hash FROM users WHERE id = %s;", (user_id,))
        username, pw_hash = cur.fetchone()

        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=username,
            google_linked=True,
            github_linked=False,
            has_password=bool(pw_hash),
            display_name=full_name or username,
            avatar_url=picture or "",
        )

        conn.commit()

        resp = jsonify({
            "access_token":  tokens["access_token"],
            "username":      username,
            "display_name":  full_name or username,
            "avatar_url":    picture or "",
            "google_linked": True,
            "github_linked": False,
            "has_password":  bool(pw_hash),
        })
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Link failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)
