from flask import Blueprint, request, jsonify
import json

from flask_cors import cross_origin
from db.postgres_pool import pg_pool
import os
from utils.cors import get_cors_origin
from jwt_helpers import jwt_required
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
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                cached_data = json.load(f)
            return jsonify(cached_data)
        except Exception as e:
            print("Error reading tag cache:", e)
            return jsonify({"error": "Unable to retrieve tags from cache."}), 500
    else:
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
    data = request.get_json()
    keywords = data.get('keywords', [])
    colors = data.get('colors', [])
    textFilters = data.get('textFilters', [])
    manaCost = data.get('manaCost', None)
    limit = data.get('limit', 20)
    last_id = data.get('lastId')
    lang = data.get('lang', 'en')

    conditions = []
    params = []

    conditions.append("lang = %s")
    params.append(lang)

    if keywords:
        keyword_conditions = []
        for keyword in keywords:
            params.append(json.dumps([keyword]))
            keyword_conditions.append("keywords @> %s::jsonb")
        conditions.append(" AND ".join(keyword_conditions))

    if colors:
        has_generic = "C" in colors
        non_generic_colors = [c for c in colors if c != "C"]
        for color in non_generic_colors:
            params.append(json.dumps([color]))
            conditions.append("colors @> %s::jsonb")
        if has_generic:
            conditions.append("mana_cost ~ '\\{(X|Y|Z|0|½|[1-9][0-9]*|1000000)\\}'")

    if textFilters:
        ts_query = " & ".join(textFilters)
        conditions.append(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(oracle_text, '')) @@ plainto_tsquery('english', %s)"
        )
        params.append(ts_query)

    if manaCost:
        operator = manaCost.get('operator')
        value = manaCost.get('value')
        if operator == 'between' and isinstance(value, list) and len(value) == 2:
            conditions.append("cmc BETWEEN %s AND %s")
            params.extend(value)
        elif operator == '<':
            conditions.append("cmc < %s")
            params.append(value)
        elif operator == '>':
            conditions.append("cmc > %s")
            params.append(value)
        elif operator == '=':
            conditions.append("cmc = %s")
            params.append(value)

    baseQuery = "FROM cards"
    if conditions:
        baseQuery += " WHERE " + " AND ".join(conditions)

    queryParams = params.copy()
    if last_id is not None:
        baseQuery += " AND id > %s"
        queryParams.append(last_id)

    orderClause = " ORDER BY id ASC"
    paginationClause = " LIMIT %s"
    queryParams.append(limit)

    query = "SELECT *, id AS card_id " + baseQuery + orderClause + paginationClause
    print("SQL Query:", query)
    print("Params:", queryParams)

    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute(query, tuple(queryParams))
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        results = [dict(zip(columns, row)) for row in rows]
        cur.close()
        return jsonify({"results": results})
    except Exception as e:
        print("Error in search route:", e)
        return jsonify({"error": "Error processing search request"}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)

@search_bp.route('/api/cards/<string:card_id>/alternate', methods=['GET'])
@cross_origin(**get_cors_origin())
@jwt_required
def get_alternate_printings(card_id):
    """
    Get alternate printings for a given card ID
    ---
    tags:
      - Search
    parameters:
      - name: card_id
        in: path
        type: string
        required: true
        description: Card UUID from the main database
    responses:
      200:
        description: Alternate printings returned
        schema:
          type: object
          properties:
            results:
              type: array
              items:
                type: object
      404:
        description: Card not found
      500:
        description: Error during retrieval
    """
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute("SELECT oracle_id FROM cards WHERE id = %s;", (card_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
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
        return jsonify({"results": alternate_printings}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print("Error retrieving alternate printings:", e)
        return jsonify({"error": "Error retrieving alternate printings"}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)
