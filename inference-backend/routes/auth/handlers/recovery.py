# routes/auth/handlers/recovery.py

from flask import request, jsonify
from jwt_helpers import jwt_required
from .. import auth_bp
from ..utils import _generate_codes, _hash_code, _check_code
from db.postgres_pool import pg_pool
from werkzeug.security import generate_password_hash

@auth_bp.route("/recovery_codes", methods=["POST"])
@jwt_required
def generate_recovery_codes():
    """
    ---
    tags:
      - Authentication
    summary: Generate one-time recovery codes
    description: |
      Clears any existing unused recovery codes for the authenticated user,
      generates a new set of one-time use codes, stores their hashes in the database,
      and returns the plaintext codes to the client.
    parameters:
      - in: header
        name: Authorization
        required: true
        type: string
        description: Bearer access token
    responses:
      201:
        description: Recovery codes generated successfully
        schema:
          type: object
          properties:
            codes:
              type: array
              items:
                type: string
      500:
        description: Failed to generate recovery codes
        schema:
          type: object
          properties:
            message:
              type: string
            error:
              type: string
    """
    user_id = request.user["user_id"]
    codes = _generate_codes()
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM recovery_codes WHERE user_id = %s AND used = FALSE;",
            (user_id,),
        )
        cur.executemany(
            "INSERT INTO recovery_codes (user_id, code_hash) VALUES (%s, %s);",
            [(user_id, _hash_code(c)) for c in codes],
        )
        conn.commit()
        return jsonify({"codes": codes}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Generation failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

@auth_bp.route("/recover", methods=["POST"])
def recover():
    """
    ---
    tags:
      - Authentication
    summary: Reset password using a recovery code
    description: |
      Accepts a one-time recovery code and a new password. Verifies the code,
      updates the user’s password in the database, marks the code as used,
      and returns a success message.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            code:
              type: string
              description: One-time recovery code provided to the user
            new_password:
              type: string
              description: The new password to set for the user
          required:
            - code
            - new_password
    responses:
      200:
        description: Password reset successfully
        schema:
          type: object
          properties:
            message:
              type: string
              example: Password reset
      400:
        description: Missing code or new_password in request
        schema:
          type: object
          properties:
            message:
              type: string
      404:
        description: Invalid or already used recovery code
        schema:
          type: object
          properties:
            message:
              type: string
      500:
        description: Server error during password recovery
        schema:
          type: object
          properties:
            message:
              type: string
            error:
              type: string
    """
    data = request.json or {}
    code   = data.get("code")
    new_pw = data.get("new_password")
    if not code or not new_pw:
        return jsonify({"message": "code and new_password required"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, user_id, code_hash FROM recovery_codes WHERE used = FALSE;"
        )
        for rc_id, user_id, chash in cur.fetchall():
            if _check_code(code, chash):
                cur.execute(
                    "UPDATE users SET password_hash = %s WHERE id = %s;",
                    (generate_password_hash(new_pw), user_id),
                )
                cur.execute("UPDATE recovery_codes SET used = TRUE WHERE id = %s;", (rc_id,))
                conn.commit()
                return jsonify({"message": "Password reset"}), 200
        return jsonify({"message": "Invalid or used code"}), 404
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Recovery failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)
