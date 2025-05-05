# routes/auth/handlers/tokens.py

import jwt
from datetime import datetime, timezone, timedelta
from flask import current_app, request, jsonify, make_response

from .. import auth_bp
from db.postgres_pool import pg_pool
from jwt_helpers import create_access_token, create_refresh_token
from utils.cookies import set_refresh_cookie
from config import JWT_SECRET, JWT_ALGORITHM

# keep this in sync with your cookie max-age
REFRESH_TOKEN_EXPIRE_DAYS = 30  


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    current_app.logger.debug(f"→ Incoming headers: {dict(request.headers)}")
    current_app.logger.debug(f"→ Incoming cookies: {request.cookies}")

    # 1) grab the raw JWT from the HttpOnly cookie
    old_rt = request.cookies.get("refresh_token")
    if not old_rt:
        current_app.logger.error("Refresh token cookie missing")
        return jsonify({"message": "refresh token cookie missing"}), 401

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        # 2) look up the token_hash in the DB and check its expires_at
        cur.execute(
            "SELECT expires_at FROM tokens WHERE token_hash = %s;",
            (old_rt,),
        )
        row = cur.fetchone()
        if not row:
            current_app.logger.error("Invalid refresh token")
            return jsonify({"message": "Invalid refresh token"}), 401

        db_expires_at = row[0]  # a tz-aware datetime from Postgres
        now_utc = datetime.now(timezone.utc)
        # compare using two aware datetimes
        if db_expires_at < now_utc:
            current_app.logger.error("Session has expired. Please log in again.")
            return jsonify({"message": "Session has expired. Please log in again."}), 401

        # 3) decode the JWT *without* enforcing its exp claim
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

        # 4) issue brand-new tokens
        new_access  = create_access_token(payload)
        new_refresh = create_refresh_token(payload)

        # 5) rotate the DB record to the fresh token + new expiry
        new_expires = now_utc + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        cur.execute(
            "UPDATE tokens SET token_hash = %s, expires_at = %s WHERE token_hash = %s;",
            (new_refresh, new_expires, old_rt),
        )
        conn.commit()

        # 6) send back the new access_token & set the rotated cookie
        resp = make_response(jsonify({
            "message":      "Token refreshed",
            "access_token": new_access,
        }), 200)
        set_refresh_cookie(resp, new_refresh)
        return resp

    except Exception as exc:
        current_app.logger.error(f"Error during token refresh: {exc}")
        return jsonify({"message": "Token refresh failed", "error": str(exc)}), 500

    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/logout", methods=["POST"])
def logout_route():
    # 1) grab the refresh token from the cookie
    rt = request.cookies.get("refresh_token")
    if not rt:
        return jsonify({"message": "refresh token cookie missing"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        # 2) delete it from the DB
        cur.execute("DELETE FROM tokens WHERE token_hash = %s;", (rt,))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Logout failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

    # 3) clear the cookie on the client side
    resp = make_response(jsonify({"message": "Logout successful"}), 200)
    resp.delete_cookie("refresh_token", path="/")
    return resp
