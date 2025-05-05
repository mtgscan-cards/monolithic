# routes/auth/handlers/oauth_google.py

from flask import request, jsonify, session, make_response, current_app
from jwt_helpers import jwt_required
from .. import auth_bp
from ..utils import verify_google_token
from ..services import issue_tokens
from db.postgres_pool import pg_pool
from utils.cookies import set_refresh_cookie

@auth_bp.route("/login/google", methods=["POST"])
def google_login():
    """
    ---
    tags:
      - Authentication
    summary: Login or register using Google OAuth token
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
        cur.execute(
            "SELECT id, username, password_hash FROM users WHERE google_sub = %s;",
            (google_sub,),
        )
        row = cur.fetchone()

        if row:
            user_id, username, pw_hash = row
            cur.execute(
                """
                UPDATE users
                   SET email       = %s,
                       full_name   = %s,
                       picture_url = %s,
                       locale      = %s
                 WHERE id = %s;
                """,
                (email, full_name, picture, locale, user_id),
            )
        else:
            cur.execute(
                "SELECT id, username, password_hash FROM users WHERE email = %s;",
                (email,),
            )
            row2 = cur.fetchone()
            if row2:
                user_id, username, pw_hash = row2
                cur.execute(
                    """
                    UPDATE users
                       SET google_sub   = %s,
                           full_name    = %s,
                           picture_url  = %s,
                           locale       = %s
                     WHERE id = %s;
                    """,
                    (google_sub, full_name, picture, locale, user_id),
                )
            else:
                username = email.split("@")[0]
                cur.execute(
                    """
                    INSERT INTO users
                      (email, username, google_sub, full_name, picture_url, locale)
                    VALUES
                      (%s, %s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (email, username, google_sub, full_name, picture, locale),
                )
                user_id = cur.fetchone()[0]
                pw_hash = None

        # issue JWTs & persist refresh token
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

        # build JSON payload without refresh_token
        payload = {
            "message":       "Login successful",
            "access_token":  tokens["access_token"],
            "user_id":       user_id,
            "username":      username,
            "display_name":  full_name or username,
            "avatar_url":    picture or "",
            "google_linked": True,
            "github_linked": False,
            "has_password":  bool(pw_hash),
        }

        # set the refresh token in an HttpOnly cookie
        resp = make_response(jsonify(payload), 200)
        set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Auth error", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/link/google", methods=["POST"])
@jwt_required
def link_google():
    """
    ---
    tags:
      - Authentication
    summary: Link a Google account to the current user
    """
    cred = (request.json or {}).get("credential")
    if not cred:
        return jsonify({"message": "credential missing"}), 400

    try:
        payload = verify_google_token(cred)
    except Exception as exc:
        return jsonify({"message": "Invalid Google token", "error": str(exc)}), 400

    google_sub = payload["sub"]
    user_id    = request.user["user_id"]

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE google_sub = %s;", (google_sub,))
        if cur.fetchone():
            return jsonify({"message": "Google account already linked"}), 409

        cur.execute(
            "UPDATE users SET google_sub = %s WHERE id = %s;",
            (google_sub, user_id),
        )
        conn.commit()
        return jsonify({"message": "Google account linked"}), 200

    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Link failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)