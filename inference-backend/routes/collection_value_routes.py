# collection_value_routes.py
import datetime
from flask import Blueprint, request, jsonify, current_app
from db.postgres_pool import pg_pool
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_cors import cross_origin
import logging
from utils.cors import get_cors_origin
logger = logging.getLogger(__name__)

collection_value_bp = Blueprint(
    'collection_value_bp',
    __name__,
    url_prefix='/collection-value'
)

@collection_value_bp.route('/<int:collection_id>/current', methods=['GET'])
@cross_origin(**get_cors_origin())
def get_current_collection_value(collection_id):
    """
    ---
    tags:
      - Collection Value
    summary: Get current USD value of a collection
    parameters:
      - name: collection_id
        in: path
        type: integer
        required: true
        description: The global ID of the collection
    responses:
      200:
        description: Current collection value in USD
        schema:
          type: object
          properties:
            collection_id:
              type: integer
            current_total_value:
              type: string
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Collection not found
      500:
        description: Internal error while calculating value
    """
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()

        cur.execute("SELECT is_public, user_id FROM collections WHERE id = %s;", (collection_id,))
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"message": "Collection not found"}), 404

        is_public, owner_id = row

        if not is_public:
            try:
                verify_jwt_in_request()
            except Exception as err:
                
                logger.debug(f"verify_jwt failed: {err}")
                return jsonify({"message": "Unauthorized"}), 401

            user_id = get_jwt_identity()
            if user_id != owner_id:
                return jsonify({"message": "Forbidden"}), 403

        conn2 = pg_pool.getconn()
        cur2 = conn2.cursor()
        cur2.execute("""
            SELECT SUM(COALESCE((cp.prices->>'usd')::numeric, 0)) AS total_value
            FROM collection_cards cc
            JOIN (
                SELECT DISTINCT ON (collection_card_id)
                       collection_card_id, prices
                FROM collection_price_snapshots
                ORDER BY collection_card_id, snapshot_date DESC
            ) cp ON cp.collection_card_id = cc.id
            WHERE cc.collection_id = %s;
        """, (collection_id,))
        row2 = cur2.fetchone()
        cur2.close()
        pg_pool.putconn(conn2)

        total_value = row2[0] if row2 and row2[0] is not None else 0

        return jsonify({
            "collection_id":        collection_id,
            "current_total_value":  str(total_value)
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({
            "message": "Error calculating current collection value",
            "error": str(e)
        }), 500

    finally:
        if conn:
            pg_pool.putconn(conn)


@collection_value_bp.route('/<int:collection_id>/history', methods=['GET'])
@cross_origin(**get_cors_origin())
def get_collection_value_history(collection_id):
    """
    ---
    tags:
      - Collection Value
    summary: Get collection value history over time
    parameters:
      - name: collection_id
        in: path
        type: integer
        required: true
        description: The global ID of the collection
      - name: range
        in: query
        type: string
        enum: ["3d", "1w", "2w", "1m", "all"]
        default: all
        description: Time range of historical values
    responses:
      200:
        description: Historical value timeline
        schema:
          type: object
          properties:
            collection_id:
              type: integer
            range:
              type: string
            current_date:
              type: string
            history:
              type: array
              items:
                type: object
                properties:
                  snapshot_date:
                    type: string
                  total_value:
                    type: string
      401:
        description: Unauthorized
      403:
        description: Forbidden
      404:
        description: Collection not found
      500:
        description: Internal error while calculating history
    """
    time_range = request.args.get('range', 'all').lower()
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute("SELECT is_public, user_id FROM collections WHERE id = %s;", (collection_id,))
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"message": "Collection not found"}), 404

        is_public, owner_id = row

        if not is_public:
            try:
                verify_jwt_in_request()
            except Exception as err:
                logger.debug(f"verify_jwt failed: {err}")
                return jsonify({"message": "Unauthorized"}), 401

            user_id = get_jwt_identity()
            if user_id != owner_id:
                return jsonify({"message": "Forbidden"}), 403

        conn2 = pg_pool.getconn()
        cur2 = conn2.cursor()
        cur2.execute("""
            SELECT MAX(snapshot_date)
            FROM collection_price_snapshots cps
            JOIN collection_cards cc ON cps.collection_card_id = cc.id
            WHERE cc.collection_id = %s;
        """, (collection_id,))
        max_date_row = cur2.fetchone()

        if not max_date_row or not max_date_row[0]:
            cur2.close()
            pg_pool.putconn(conn2)
            return jsonify({
                "collection_id": collection_id,
                "range":         time_range,
                "history":       []
            }), 200

        current_date = max_date_row[0]

        if time_range == '3d':
            cutoff = current_date - datetime.timedelta(days=3)
        elif time_range == '1w':
            cutoff = current_date - datetime.timedelta(weeks=1)
        elif time_range == '2w':
            cutoff = current_date - datetime.timedelta(weeks=2)
        elif time_range == '1m':
            cutoff = current_date - datetime.timedelta(days=30)
        else:
            cutoff = None

        if cutoff:
            cur2.execute("""
                SELECT snapshot_date,
                       SUM(COALESCE((prices->>'usd')::numeric,0)) AS total_value
                FROM collection_price_snapshots cps
                JOIN collection_cards cc ON cps.collection_card_id = cc.id
                WHERE cc.collection_id = %s
                  AND snapshot_date BETWEEN %s AND %s
                GROUP BY snapshot_date
                ORDER BY snapshot_date;
            """, (collection_id, cutoff, current_date))
        else:
            cur2.execute("""
                SELECT snapshot_date,
                       SUM(COALESCE((prices->>'usd')::numeric,0)) AS total_value
                FROM collection_price_snapshots cps
                JOIN collection_cards cc ON cps.collection_card_id = cc.id
                WHERE cc.collection_id = %s
                  AND snapshot_date <= %s
                GROUP BY snapshot_date
                ORDER BY snapshot_date;
            """, (collection_id, current_date))

        rows = cur2.fetchall()
        cur2.close()
        pg_pool.putconn(conn2)

        history = [
            {
                "snapshot_date": r[0].isoformat(),
                "total_value":   str(r[1])
            }
            for r in rows
        ]

        return jsonify({
            "collection_id":  collection_id,
            "range":          time_range,
            "current_date":   current_date.isoformat(),
            "history":        history
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({
            "message": "Error calculating collection history",
            "error": str(e)
        }), 500

    finally:
        if conn:
            pg_pool.putconn(conn)
