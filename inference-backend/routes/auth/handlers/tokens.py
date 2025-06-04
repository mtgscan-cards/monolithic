# routes/auth/handlers/tokens.py

import logging
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
logger = logging.getLogger(__name__)

@auth_bp.route("/refresh", methods=["POST", "OPTIONS"])
@cross_origin(**get_cors_origin())
def refresh():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    logger.debug("↪ Refresh token request received")
    logger.debug(f"↪ Headers: {dict(request.headers)}")
    logger.debug(f"↪ Cookies: {request.cookies}")

    old_rt = request.cookies.get("refresh_token")
    if not old_rt:
        logger.warning("❌ Missing refresh_token cookie")
        return jsonify({"message": "refresh token cookie missing"}), 401

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT expires_at FROM tokens WHERE token_hash = %s;", (old_rt,))
        row = cur.fetchone()
        if not row:
            logger.warning("❌ Refresh token not found in DB")
            return jsonify({"message": "Invalid refresh token"}), 401

        db_expires_at = row[0]
        now_utc = datetime.now(timezone.utc)
        if db_expires_at < now_utc:
            logger.warning(f"❌ Refresh token expired at {db_expires_at.isoformat()}")
            return jsonify({"message": "Session has expired."}), 401

        try:
            payload = jwt.decode(
                old_rt,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"verify_exp": False}
            )
            logger.info(f"🔐 Refresh token verified for user_id={payload.get('user_id')}")
        except jwt.PyJWTError as e:
            logger.error(f"❌ JWT decode failed: {e}")
            return jsonify({"message": "Invalid refresh token", "error": str(e)}), 401

        new_access  = create_access_token(payload)
        new_refresh = create_refresh_token(payload)
        new_expires = now_utc + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        cur.execute(
            "UPDATE tokens SET token_hash = %s, expires_at = %s WHERE token_hash = %s;",
            (new_refresh, new_expires, old_rt),
        )
        conn.commit()

        logger.info(f"✅ Refreshed token for user_id={payload.get('user_id')}, new expiration: {new_expires.isoformat()}")

        resp = make_response(jsonify({
            "message": "Token refreshed",
            "access_token": new_access,
        }), 200)
        set_refresh_cookie(resp, new_refresh)
        return resp

    except Exception as exc:
        logger.exception(f"🔥 Error during refresh: {exc}")
        return jsonify({"message": "Token refresh failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)


@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
@cross_origin(**get_cors_origin())
def logout_route():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    logger.debug("↪ Logout request received")

    rt = request.cookies.get("refresh_token")
    if not rt:
        logger.warning("❌ Logout request missing refresh_token cookie")
        return jsonify({"message": "refresh token cookie missing"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM tokens WHERE token_hash = %s;", (rt,))
        conn.commit()
        logger.info("✅ Refresh token revoked during logout")
    except Exception as exc:
        conn.rollback()
        logger.exception(f"🔥 Logout error: {exc}")
        return jsonify({"message": "Logout failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

    resp = make_response(jsonify({"message": "Logout successful"}), 200)
    resp.delete_cookie("refresh_token", path="/")
    return resp