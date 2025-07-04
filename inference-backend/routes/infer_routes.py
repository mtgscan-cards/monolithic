import logging
from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import time
from utils.sift_features import find_closest_card_ransac
from utils.resource_manager import load_resources
from db.postgres_pool import pg_pool  # Import the connection pool
from extensions import limiter
logger = logging.getLogger(__name__)

infer_bp = Blueprint('infer_bp', __name__)

# Load heavy resources once at startup
faiss_index, hf, id_map = load_resources()

@infer_bp.route('/infer', methods=['POST'])
@limiter.limit("200 per minute; 5000 per hour")
def infer():
    """
    Perform card inference from ROI image
    ---
    tags:
      - Inference
    consumes:
      - multipart/form-data
    parameters:
      - name: roi_image
        in: formData
        type: file
        required: true
        description: Region of interest image (e.g., cropped card)
    responses:
      200:
        description: Inference result containing predicted card metadata
        schema:
          type: object
          properties:
            predicted_card_id:
              type: string
            predicted_card_name:
              type: string
            finishes:
              type: array
              items:
                type: string
            set:
              type: string
            set_name:
              type: string
            prices:
              type: object
              properties:
                usd:
                  type: string
                usd_foil:
                  type: string
            image_uris:
              type: object
              properties:
                normal:
                  type: string
      400:
        description: Image missing or invalid
      404:
        description: Card not found
      500:
        description: Server error during inference or database access
    """
    overall_start = time.perf_counter()
    
    # Read the uploaded file.
    file_read_start = time.perf_counter()
    if 'roi_image' not in request.files:
        return jsonify({'error': 'No ROI image uploaded.'}), 400
    file = request.files['roi_image']
    file_bytes = np.frombuffer(file.read(), np.uint8)
    file_read_time = time.perf_counter() - file_read_start
    logger.info(f"File read took: {file_read_time:.3f} seconds")
    
    # Decode the image.
    roi_decode_start = time.perf_counter()
    roi_image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if roi_image is None:
        return jsonify({'error': 'Invalid image format.'}), 400
    roi_decode_time = time.perf_counter() - roi_decode_start
    logger.info(f"Image decode took: {roi_decode_time:.3f} seconds")
    
    # Process the image using SIFT/RANSAC.
    sift_start = time.perf_counter()
    best_candidate, _, keypoints, processed_img, debug_info = find_closest_card_ransac(
        roi_image, k=3
    )
    sift_time = time.perf_counter() - sift_start
    logger.info(f"SIFT/RANSAC processing took: {sift_time:.3f} seconds")

    if not best_candidate:
        logger.debug("SIFT/RANSAC found no matching card in ROI")
        return jsonify({'error': 'No matching card found.'}), 404
    
    # Query Postgres for card details including the card name.
    db_query_start = time.perf_counter()
    conn = None
    cur = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        query = """
            SELECT name, finishes, "set", set_name, prices, image_uris, collector_number
            FROM cards
            WHERE id = %s
        """
        cur.execute(query, (best_candidate,))
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

    db_query_time = time.perf_counter() - db_query_start
    logger.info(f"Database query took: {db_query_time:.3f} seconds")
    
    overall_time = time.perf_counter() - overall_start
    logger.info(f"Overall inference took: {overall_time:.3f} seconds")
    
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
