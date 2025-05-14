# routes/auth/handlers/tokens.py

from flask_cors import cross_origin
import jwt
from datetime import datetime, timezone, timedelta
from flask import current_app, request, jsonify, make_response

from .. import auth_bp
from db.postgres_pool import pg_pool
from jwt_helpers import create_access_token, create_refresh_token
from utils.cookies import set_refresh_cookie
from config import JWT_SECRET, JWT_ALGORITHM
from utils.cors import get_cors_origin

REFRESH_TOKEN_EXPIRE_DAYS = 30  # Keep this in sync with cookie max-age


@auth_bp.route("/refresh", methods=["POST", "OPTIONS"])
@cross_origin(**get_cors_origin())
def refresh():
    """
    ---
    tags:
      - Authentication
    summary: Issue new access and refresh tokens from a valid refresh token cookie
    responses:
      200:
        description: Tokens refreshed successfully
        schema:
          type: object
          properties:
            message: { type: string, example: "Token refreshed" }
            access_token: { type: string }
      401:
        description: Invalid or expired refresh token
      500:
        description: Server error during refresh
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    current_app.logger.debug(f"→ Incoming headers: {dict(request.headers)}")
    current_app.logger.debug(f"→ Incoming cookies: {request.cookies}")

    old_rt = request.cookies.get("refresh_token")
    if not old_rt:
        current_app.logger.error("Refresh token cookie missing")
        return jsonify({"message": "refresh token cookie missing"}), 401

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT expires_at FROM tokens WHERE token_hash = %s;",
            (old_rt,),
        )
        row = cur.fetchone()
        if not row:
            current_app.logger.error("Invalid refresh token")
            return jsonify({"message": "Invalid refresh token"}), 401

        db_expires_at = row[0]
        now_utc = datetime.now(timezone.utc)
        if db_expires_at < now_utc:
            current_app.logger.error("Session has expired.")
            return jsonify({"message": "Session has expired."}), 401

        try:
            payload = jwt.decode(
                old_rt,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"verify_exp": False}
            )
        except jwt.PyJWTError as e:
            current_app.logger.error(f"Invalid refresh token: {e}")
            return jsonify({"message": "Invalid refresh token", "error": str(e)}), 401

        new_access  = create_access_token(payload)
        new_refresh = create_refresh_token(payload)
        new_expires = now_utc + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        cur.execute(
            "UPDATE tokens SET token_hash = %s, expires_at = %s WHERE token_hash = %s;",
            (new_refresh, new_expires, old_rt),
        )
        conn.commit()

        resp = make_response(jsonify({
            "message": "Token refreshed",
            "access_token": new_access,
        }), 200)
        set_refresh_cookie(resp, new_refresh)
        return resp

    except Exception as exc:
        current_app.logger.error(f"Error during token refresh: {exc}")
        return jsonify({"message": "Token refresh failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
@cross_origin(**get_cors_origin())
def logout_route():
    """
    ---
    tags:
      - Authentication
    summary: Log out and revoke the refresh token
    responses:
      200:
        description: Logout successful
        schema:
          type: object
          properties:
            message: { type: string, example: "Logout successful" }
      400:
        description: No refresh token cookie
      500:
        description: Server error during logout
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    rt = request.cookies.get("refresh_token")
    if not rt:
        return jsonify({"message": "refresh token cookie missing"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM tokens WHERE token_hash = %s;", (rt,))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Logout failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

    resp = make_response(jsonify({"message": "Logout successful"}), 200)
    resp.delete_cookie("refresh_token", path="/")
    return resp
