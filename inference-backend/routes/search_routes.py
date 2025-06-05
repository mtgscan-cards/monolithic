from flask import Blueprint, request, jsonify
import json

from flask_cors import cross_origin
from db.postgres_pool import pg_pool
import os
from utils.cors import get_cors_origin
from jwt_helpers import jwt_required
import logging
logger = logging.getLogger(__name__)
search_bp = Blueprint('search_bp', __name__)

@search_bp.route('/api/tags', methods=['GET'])
@cross_origin(**get_cors_origin())
@jwt_required
def get_tags():
    """
    Get popular keyword tags
    ---
    tags:
      - Search
    responses:
      200:
        description: Tag data retrieved from cache
        schema:
          type: object
          properties:
            tags:
              type: array
              items:
                type: object
                properties:
                  keyword:
                    type: string
                  count:
                    type: integer
      500:
        description: Error retrieving tag cache
    """
    cache_file = 'tags_cache.json'
    logger.info("[TAGS] Attempting to load tag cache")
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                cached_data = json.load(f)
            logger.info("[TAGS] Cache loaded successfully")
            return jsonify(cached_data)
        except Exception as e:
            logger.exception("[TAGS] Error reading tag cache")
            return jsonify({"error": "Unable to retrieve tags from cache."}), 500
    else:
        logger.warning("[TAGS] Cache file does not exist")
        return jsonify({"error": "Tag cache not found."}), 500
    
@search_bp.route('/api/search', methods=['POST'])
@cross_origin(**get_cors_origin())
@jwt_required
def search_cards():
    """
    Search for cards using various filters
    ---
    tags:
      - Search
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            keywords:
              type: array
              items:
                type: string
            colors:
              type: array
              items:
                type: string
            textFilters:
              type: array
              items:
                type: string
            manaCost:
              type: object
              properties:
                operator:
                  type: string
                  enum: ["<", ">", "=", "between"]
                value:
                  oneOf:
                    - type: number
                    - type: array
                      items:
                        type: number
            lastId:
              type: string
            limit:
              type: integer
              default: 20
            lang:
              type: string
              default: en
    responses:
      200:
        description: Matching cards returned
        schema:
          type: object
          properties:
            results:
              type: array
              items:
                type: object
      500:
        description: Error during search
    """
    logger.info("[SEARCH] Search request received")

    data = request.get_json()
    keywords = data.get('keywords', [])
    colors = data.get('colors', [])
    textFilters = data.get('textFilters', [])
    manaCost = data.get('manaCost', None)
    limit = data.get('limit', 20)
    last_id = data.get('lastId')
    lang = data.get('lang', 'en')

    conditions = ["lang = %s"]
    params = [lang]

    if keywords:
        for keyword in keywords:
            params.append(json.dumps([keyword]))
        conditions.append(" AND ".join(["keywords @> %s::jsonb"] * len(keywords)))

    if colors:
        has_generic = "C" in colors
        for color in [c for c in colors if c != "C"]:
            params.append(json.dumps([color]))
            conditions.append("colors @> %s::jsonb")
        if has_generic:
            conditions.append("mana_cost ~ '\\{(X|Y|Z|0|½|[1-9][0-9]*|1000000)\\}'")

    if textFilters:
        ts_query = " & ".join(textFilters)
        conditions.append("to_tsvector('english', coalesce(name, '') || ' ' || coalesce(oracle_text, '')) @@ plainto_tsquery('english', %s)")
        params.append(ts_query)

    if manaCost:
        operator = manaCost.get('operator')
        value = manaCost.get('value')
        if operator == 'between' and isinstance(value, list) and len(value) == 2:
            conditions.append("cmc BETWEEN %s AND %s")
            params.extend(value)
        elif operator in ['<', '>', '=']:
            conditions.append(f"cmc {operator} %s")
            params.append(value)

    base_query = "FROM cards"
    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    if last_id is not None:
        base_query += " AND id > %s"
        params.append(last_id)

    query = f"SELECT *, id AS card_id {base_query} ORDER BY id ASC LIMIT %s"
    params.append(limit)

    logger.debug(f"[SEARCH] SQL: {query}")
    logger.debug(f"[SEARCH] Params: {params}")

    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        results = [dict(zip(columns, row)) for row in rows]
        cur.close()
        logger.info(f"[SEARCH] Found {len(results)} results")
        return jsonify({"results": results})
    except Exception as e:
        logger.exception("[SEARCH] Error executing search")
        return jsonify({"error": "Error processing search request"}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)

@search_bp.route('/api/cards/<string:card_id>/alternate', methods=['GET'])
@cross_origin(**get_cors_origin())
@jwt_required
def get_alternate_printings(card_id):
    logger.info(f"[ALTERNATES] Looking up alternates for card ID: {card_id}")
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute("SELECT oracle_id FROM cards WHERE id = %s;", (card_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            logger.warning(f"[ALTERNATES] Card ID not found: {card_id}")
            return jsonify({"error": "Card not found"}), 404

        oracle_id = row[0]
        cur.execute("""
            SELECT
                id AS card_id,
                name,
                mana_cost,
                cmc,
                type_line,
                oracle_text,
                flavor_text,
                colors,
                color_identity,
                image_uris,
                set,
                set_name,
                lang,
                layout
            FROM cards
            WHERE oracle_id = %s;
        """, (oracle_id,))
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        alternate_printings = [dict(zip(columns, r)) for r in rows]
        cur.close()

        logger.info(f"[ALTERNATES] Found {len(alternate_printings)} alternate printings")
        return jsonify({"results": alternate_printings}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        logger.exception("[ALTERNATES] Error retrieving alternate printings")
        return jsonify({"error": "Error retrieving alternate printings"}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)
