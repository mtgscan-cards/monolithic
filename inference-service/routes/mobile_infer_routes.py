from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
import cv2
from flask_cors import cross_origin
import numpy as np
import json
import uuid
from flask_jwt_extended import jwt_required, get_jwt_identity
from flasgger import swag_from

from utils.sift_features import find_closest_card_ransac
from utils.resource_manager import load_resources
from db.postgres_pool import pg_pool
from utils.cors import get_cors_origin
import logging

logger = logging.getLogger(__name__)

mobile_infer_bp = Blueprint('mobile_infer_bp', __name__, url_prefix="/api/mobile-infer")

# Load resources once
faiss_index, hf, id_map = load_resources()

@mobile_infer_bp.route("/create", methods=["POST"])
@jwt_required()
@cross_origin(**get_cors_origin())
@swag_from({
    'tags': ['Mobile Inference'],
    'summary': 'Create a new mobile scan session',
    'description': 'Generates a new scan session for mobile device interaction. Requires authentication.',
    'responses': {
        200: {
            'description': 'Session created successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'session_id': {'type': 'string'}
                }
            }
        },
        500: {
            'description': 'Server error',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        }
    },
    'security': [{'BearerAuth': []}]
})


def mobile_infer_create():
    session_id = str(uuid.uuid4())
    user_id = get_jwt_identity()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=55)

    logger.info(f"[CREATE] Generating session {session_id} for user {user_id}")

    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()

        cur.execute("""
            DELETE FROM mobile_scan_results
            WHERE session_id IN (
                SELECT id FROM mobile_scan_sessions WHERE expires_at < NOW()
            )
        """)
        cur.execute("DELETE FROM mobile_scan_sessions WHERE expires_at < NOW()")

        cur.execute("""
            INSERT INTO mobile_scan_sessions (id, user_id, completed, result, expires_at)
            VALUES (%s, %s, FALSE, NULL, %s)
        """, (session_id, user_id, expires_at))

        conn.commit()
        logger.info(f"[CREATE] Session {session_id} inserted into DB (expires at {expires_at.isoformat()})")
        return jsonify({"session_id": session_id}), 200

    except Exception as e:
        logger.exception(f"[CREATE] Failed to create session {session_id}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            pg_pool.putconn(conn)

@mobile_infer_bp.route("/submit/<session_id>", methods=["POST"])
@swag_from({
    'tags': ['Mobile Inference'],
    'summary': 'Submit an ROI image for a session',
    'consumes': ['multipart/form-data'],
    'parameters': [
        {
            'name': 'session_id',
            'in': 'path',
            'type': 'string',
            'required': True,
            'description': 'The session ID to attach this submission to'
        },
        {
            'name': 'roi_image',
            'in': 'formData',
            'type': 'file',
            'required': True,
            'description': 'Cropped JPEG image of the detected card region'
        }
    ],
    'responses': {
        200: {
            'description': 'Scan submitted and stored',
            'schema': {
                'type': 'object',
                'properties': {
                    'status': {'type': 'string'}
                }
            }
        },
        400: {
            'description': 'Missing or invalid image',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        },
        403: {
            'description': 'Session expired',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        },
        404: {
            'description': 'Session not found or card not found',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        },
        500: {
            'description': 'Internal server error',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        }
    }
})
def mobile_infer_submit(session_id):
    logger.info(f"[SUBMIT] Received submission for session {session_id}")

    if 'roi_image' not in request.files:
        logger.warning(f"[SUBMIT] No roi_image provided for session {session_id}")
        return jsonify({'error': 'Missing roi_image'}), 400

    file = request.files['roi_image']
    file_bytes = np.frombuffer(file.read(), np.uint8)
    roi_image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if roi_image is None:
        logger.warning(f"[SUBMIT] Invalid image format for session {session_id}")
        return jsonify({'error': 'Invalid image'}), 400

    try:
        best_candidate, _, keypoints, processed_img, debug_info = find_closest_card_ransac(
            roi_image,
            k=3
        )
    except Exception as e:
        logger.exception("[SUBMIT] Error during RANSAC processing")
        return jsonify({'error': f'RANSAC processing failed: {str(e)}'}), 500

    if not best_candidate:
        logger.info(f"[SUBMIT] No matching card found for session {session_id}")
        return jsonify({'error': 'No matching card found'}), 404

    conn = None
    cur = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()

        # Validate session
        cur.execute("SELECT expires_at FROM mobile_scan_sessions WHERE id = %s", (session_id,))
        session_row = cur.fetchone()

        if not session_row:
            logger.warning(f"[SUBMIT] Session not found: {session_id}")
            return jsonify({'error': 'Session not found'}), 404

        if session_row[0] < datetime.now(timezone.utc):
            logger.info(f"[SUBMIT] Session expired: {session_id}")
            return jsonify({'error': 'Session expired'}), 403

        # Fetch card metadata
        cur.execute("""
            SELECT name, finishes, "set", set_name, prices, image_uris, collector_number
            FROM cards WHERE id = %s
        """, (best_candidate,))
        row = cur.fetchone()

        if not row:
            logger.info(f"[SUBMIT] Card ID not found in DB: {best_candidate}")
            return jsonify({'error': 'Card ID not found'}), 404

        name, finishes, set_, set_name, prices, image_uris, collector_number = row
        if collector_number:
            collector_number = collector_number.lstrip('0')

        scan_data = {
            "predicted_card_id": best_candidate,
            "predicted_card_name": name,
            "finishes": finishes,
            "set": set_,
            "set_name": set_name,
            "prices": prices,
            "image_uris": image_uris,
            "collector_number": collector_number
        }

        # Insert result
        cur.execute("""
            INSERT INTO mobile_scan_results (id, session_id, result, created_at)
            VALUES (%s, %s, %s, %s)
        """, (
            str(uuid.uuid4()),
            session_id,
            json.dumps(scan_data),
            datetime.now(timezone.utc)
        ))

        conn.commit()

        logger.info(f"[SUBMIT] Successfully stored scan result for session {session_id}")

        # Return immediate result for debugging
        return jsonify({
            "status": "success",
            **scan_data
        }), 200

    except Exception as e:
        logger.exception(f"[SUBMIT] Error during submission for session {session_id}")
        return jsonify({'error': str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            pg_pool.putconn(conn)

@mobile_infer_bp.route("/result/<session_id>", methods=["GET"])
@swag_from({
    'tags': ['Mobile Inference'],
    'summary': 'Get the scan result for a session',
    'parameters': [
        {
            'name': 'session_id',
            'in': 'path',
            'type': 'string',
            'required': True,
            'description': 'The session ID to fetch results for'
        }
    ],
    'responses': {
        200: {
            'description': 'Scan result retrieved',
            'schema': {
                'type': 'object',
                'properties': {
                    'completed': {'type': 'boolean'},
                    'result_id': {'type': 'string'},
                    'result': {
                        'type': ['object', 'null'],
                        'description': 'Detected card data if scan completed'
                    }
                }
            }
        },
        403: {
            'description': 'Session expired',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        },
        404: {
            'description': 'Session not found',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        },
        500: {
            'description': 'Internal server error',
            'schema': {
                '$ref': '#/definitions/ErrorResponse'
            }
        }
    }
})
def get_mobile_scan_result(session_id):
    logger.info(f"[RESULT] Fetching result for session {session_id}")
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()

        cur.execute("""
            SELECT r.id, r.result, s.expires_at
            FROM mobile_scan_sessions s
            LEFT JOIN mobile_scan_results r ON s.id = r.session_id
            WHERE s.id = %s
            ORDER BY r.created_at DESC
            LIMIT 1
        """, (session_id,))
        row = cur.fetchone()
        cur.close()

        if not row:
            logger.warning(f"[RESULT] Session not found: {session_id}")
            return jsonify({"error": "Session not found"}), 404

        result_id, result_data, expires_at = row

        if expires_at and expires_at < datetime.now(timezone.utc):
            logger.info(f"[RESULT] Session expired: {session_id}")
            return jsonify({"error": "Session expired"}), 403

        if result_data is None:
            logger.info(f"[RESULT] No result yet for session {session_id}")
            return jsonify({"completed": False, "result": None}), 200

        logger.info(f"[RESULT] Returning result for session {session_id}")
        return jsonify({
            "completed": True,
            "result_id": str(result_id),
            "result": result_data
        }), 200

    except Exception as e:
        logger.exception(f"[RESULT] Error fetching result for session {session_id}")
        return jsonify({'error': str(e)}), 500

    finally:
        if conn:
            pg_pool.putconn(conn)
