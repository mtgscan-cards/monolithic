import logging
from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import time
from utils.sift_features import find_closest_card_ransac
from utils.resource_manager import load_resources
from db.postgres_pool import pg_pool

logger = logging.getLogger(__name__)
infer_bp = Blueprint('infer_bp', __name__)

# Load heavy resources once at startup
faiss_index, hf, id_map = load_resources()

@infer_bp.route('/infer', methods=['POST'])
def infer():
    overall_start = time.perf_counter()

    if 'roi_image' not in request.files:
        return jsonify({'error': 'No ROI image uploaded.'}), 400
    file = request.files['roi_image']
    file_bytes = np.frombuffer(file.read(), np.uint8)

    roi_image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if roi_image is None:
        return jsonify({'error': 'Invalid image format.'}), 400

    best_candidate, _, keypoints, processed_img, debug_info = find_closest_card_ransac(
        roi_image, k=3
    )

    if not best_candidate:
        logger.debug("SIFT/RANSAC found no matching card in ROI")
        return jsonify({'error': 'No matching card found.'}), 404

    conn = cur = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute("""
            SELECT name, finishes, "set", set_name, prices, image_uris, collector_number
            FROM cards
            WHERE id = %s
        """, (best_candidate,))
        row = cur.fetchone()

        if not row:
            return jsonify({'error': 'Card not found in database.'}), 404

        card_name, finishes, set_field, set_name, prices, image_uris, collector_number = row
        if collector_number is not None:
            collector_number = collector_number.lstrip('0')

    except Exception as e:
        return jsonify({'error': 'Error fetching card details', 'details': str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            pg_pool.putconn(conn)

    result = {
        'predicted_card_id': best_candidate,
        'predicted_card_name': card_name,
        'finishes': finishes,
        'set': set_field,
        'set_name': set_name,
        'prices': prices,
        'image_uris': image_uris,
        'collector_number': collector_number
    }
    return jsonify(result), 200
