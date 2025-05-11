"""
blueprints/collections.py
─────────────────────────────────────────────────────────────────────────
Flask blueprint that handles:

• CRUD for user collections
• CRUD for cards inside a collection
• Full OpenAPI / Swagger 2‑style docstrings compatible with Flasgger
• Per‑route CORS (flask‑cors) so pre‑flight requests succeed

Assumes:
    pg_pool           – psycopg2 pool (db.postgres_pool.pg_pool)
    jwt_required      – decorator that injects request.user with at least
                        {"user_id": int, "username": str}
In your `app.py` you must initialise Flasgger:

    from flasgger import Swagger
    app = Flask(__name__)
    Swagger(app, template={
        "swagger": "2.0",
        "info": {"title": "Collection API", "version": "1.0"},
        "schemes": ["http"],
        "definitions": {
            "Color": {
                "type": "object",
                "properties": {
                    "top": {"type": "integer", "example": 16777215},
                    "bottom": {"type": "integer", "example": 9109504},
                },
            },
            "Collection": {
                "type": "object",
                "properties": {
                    "global_id": {"type": "integer"},
                    "user_collection_id": {"type": "integer"},
                    "label": {"type": "string"},
                    "cardStackStateIndex": {"type": "integer"},
                    "color": {"$ref": "#/definitions/Color"},
                    "is_public": {"type": "boolean"},
                    "is_manual_state": {"type": "boolean"},
                },
            },
            "CollectionCard": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "card_id": {"type": "integer"},
                    "name": {"type": "string"},
                    "set": {"type": "string"},
                    "set_name": {"type": "string"},
                    "lang": {"type": "string"},
                    "layout": {"type": "string"},
                    "image_uris": {"type": "object"},
                    "added_at": {"type": "string", "format": "date‑time"},
                },
            },
        },
        "securityDefinitions": {
            "BearerAuth": {"type": "apiKey", "in": "header", "name": "Authorization"}
        },
    })

"""

import re
from uuid import UUID
from flask import Blueprint, current_app, request, jsonify
from flask_cors import cross_origin
from db.postgres_pool import pg_pool
from jwt_helpers import jwt_required

collections_bp = Blueprint("collections_bp", __name__, url_prefix="/collections")


# ───────────────────────── helper ──────────────────────────
def get_global_collection_id(user_id: int, user_collection_id: int, conn):
    """Translate per‑user collection id → primary‑key id or None."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM collections WHERE user_id = %s AND user_collection_id = %s;",
        (user_id, user_collection_id),
    )
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None


# ══════════════════ Collection‑level endpoints ══════════════════
@collections_bp.route("", methods=["POST"])
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
@jwt_required
def create_collection():
    """
    Create a new collection
    ---
    tags: [Collections]
    security: [{BearerAuth: []}]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [label, color]
          properties:
            label: {type: string, example: "Modern Burn"}
            cardStackStateIndex: {type: integer, default: 0}
            color: {$ref: '#/definitions/Color'}
            is_public: {type: boolean, default: false}
            is_manual_state: {type: boolean, default: false}
    responses:
      201: {description: Collection created, schema: {$ref: '#/definitions/Collection'}}
      400: {description: Invalid input}
      401: {description: Unauthorized}
      500: {description: Server error}
    """
    data = request.get_json() or {}
    label = data.get("label")
    color = data.get("color")
    card_stack_state_index = data.get("cardStackStateIndex", 0)
    is_public = data.get("is_public", False)
    is_manual_state = data.get("is_manual_state", False)

    if not label or not color:
        return jsonify({"message": "Invalid data provided"}), 400

    user_id = request.user.get("user_id")
    username = request.user.get("username")
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        cur.execute(
            "SELECT COALESCE(MAX(user_collection_id),0)+1 FROM collections WHERE user_id = %s;",
            (user_id,),
        )
        next_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO collections
                (user_id, label, card_stack_state_index,
                 color_top, color_bottom, is_public,
                 is_manual_state, user_collection_id, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            RETURNING id, user_collection_id;
            """,
            (
                user_id,
                label,
                card_stack_state_index,
                color["top"],
                color["bottom"],
                is_public,
                is_manual_state,
                next_id,
            ),
        )
        global_id, user_col_id = cur.fetchone()
        conn.commit()
        cur.close()

        return (
            jsonify(
                {
                    "global_id": global_id,
                    "user_collection_id": user_col_id,
                    "label": label,
                    "cardStackStateIndex": card_stack_state_index,
                    "color": color,
                    "username": username,
                    "is_public": is_public,
                    "is_manual_state": is_manual_state,
                }
            ),
            201,
        )
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": "Error creating collection", "error": str(e)}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)


@collections_bp.route("", methods=["GET"])
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
@jwt_required
def list_collections():
    """
    List user’s collections
    ---
    tags: [Collections]
    security: [{BearerAuth: []}]
    responses:
      200:
        description: Array of collections
        schema:
          type: array
          items: {$ref: '#/definitions/Collection'}
      401: {description: Unauthorized}
      500: {description: Server error}
    """
    user_id = request.user.get("user_id")
    conn = None
    try:
        conn = pg_pool.getconn()
        cur = conn.cursor()
        # Now SELECT id AS global_id
        cur.execute(
            """
            SELECT
              id,
              user_collection_id,
              label,
              card_stack_state_index,
              color_top,
              color_bottom,
              is_public,
              is_manual_state
            FROM collections
            WHERE user_id = %s
            ORDER BY created_at DESC;
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()

        # Build the JSON objects including the new global_id field
        data = [
            {
                "global_id": row[0],
                "user_collection_id": row[1],
                "label": row[2],
                "cardStackStateIndex": row[3],
                "color": {"top": row[4], "bottom": row[5]},
                "is_public": row[6],
                "is_manual_state": row[7],
            }
            for row in rows
        ]
        return jsonify(data), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": "Error retrieving collections", "error": str(e)}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)

from flask import jsonify, current_app
from flask_cors import cross_origin
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

@collections_bp.route(
    "/<string:username>/collection/<int:user_collection_id>",
    methods=["GET"]
)
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
def get_collection(
    username: str,
    user_collection_id: int,
):
    """
    Fetch a single collection’s metadata.  Public if is_public=True, otherwise owner‐only.
    ---
    tags: [Collections]
    parameters:
      - name: username
        in: path
        required: true
        type: string
      - name: user_collection_id
        in: path
        required: true
        type: integer
    responses:
      200: {description: Collection metadata}
      401: {description: Unauthorized}
      403: {description: Forbidden}
      404: {description: Collection not found}
      500: {description: Server error}
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        # 1) grab the row
        cur.execute("""
            SELECT c.id,
                   c.user_collection_id,
                   c.label,
                   c.card_stack_state_index,
                   c.color_top,
                   c.color_bottom,
                   c.is_public,
                   c.is_manual_state,
                   c.user_id
            FROM collections c
            JOIN users u ON u.id = c.user_id
            WHERE u.username = %s
              AND c.user_collection_id = %s
        """, (username, user_collection_id))
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"message": "Collection not found"}), 404

        (
            global_id,
            per_user_id,
            label,
            stack_index,
            color_top,
            color_bottom,
            is_public,
            is_manual_state,
            owner_id,
        ) = row

        # 2) If private, require JWT + owner check
        if not is_public:
            try:
                verify_jwt_in_request()
            except Exception as err:
                current_app.logger.debug(f"verify_jwt failed: {err}")
                return jsonify({"message": "Unauthorized"}), 401

            user_id = get_jwt_identity()
            current_app.logger.debug(f"JWT identity (user_id): {user_id}, owner_id: {owner_id}")
            if user_id != owner_id:
                return jsonify({"message": "Forbidden"}), 403

        # 3) return the metadata
        return jsonify({
            "global_id":            global_id,
            "user_collection_id":   per_user_id,
            "label":                label,
            "cardStackStateIndex":  stack_index,
            "color": {
                "top":    color_top,
                "bottom": color_bottom,
            },
            "is_public":         is_public,
            "is_manual_state":   is_manual_state,
        }), 200

    except Exception as e:
        conn.rollback()
        current_app.logger.exception("Error retrieving collection metadata")
        return jsonify({"message": "Error retrieving collection", "error": str(e)}), 500

    finally:
        pg_pool.putconn(conn)

# ════════════════ Card‑level endpoints ════════════════════════
@collections_bp.route(
    "/<string:username>/collection/<int:user_collection_id>/cards", methods=["POST"]
)
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
@jwt_required
def add_card_to_collection(username, user_collection_id):
    """
    Add a card to a collection
    ---
    tags: [Collection Cards]
    security: [{BearerAuth: []}]
    consumes: [application/json]
    parameters:
      - {name: username, in: path, required: true, type: string}
      - {name: user_collection_id, in: path, required: true, type: integer}
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [card_id]
          properties:
            card_id:
              type: string
              format: uuid
              example: "bcdd5e1c-47db-4960-860c-2af14b734b59"
    responses:
      201:
        description: Added
        schema:
          type: object
          properties:
            message: {type: string}
            collection_card_id: {type: integer}
      400: {description: Invalid input}
      401: {description: Unauthorized}
      404: {description: Collection not found}
      500: {description: Server error}
    """
    data = request.get_json() or {}
    raw_card_id = data.get("card_id")

    try:
        card_id = str(UUID(raw_card_id))
    except Exception:
        return jsonify({"message": "Invalid or missing card_id"}), 400

    user_id = request.user.get("user_id")
    conn = None
    try:
        conn = pg_pool.getconn()
        global_id = get_global_collection_id(user_id, user_collection_id, conn)
        if not global_id:
            return jsonify({"message": "Collection not found"}), 404

        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO collection_cards (collection_id, card_id, added_at)
            VALUES (%s, %s, NOW()) RETURNING id;
            """,
            (global_id, card_id),
        )
        collection_card_id = cur.fetchone()[0]
        conn.commit()

        # snapshot price
        cur.execute(
            """
            INSERT INTO collection_price_snapshots (collection_card_id, snapshot_date, prices)
            SELECT %s, CURRENT_DATE, prices FROM cards WHERE id=%s
            ON CONFLICT (collection_card_id, snapshot_date) DO NOTHING;
            """,
            (collection_card_id, card_id),
        )
        conn.commit()

        # auto‑state update when not manual
        cur.execute("SELECT is_manual_state FROM collections WHERE id=%s;", (global_id,))
        is_manual = cur.fetchone()[0]
        if not is_manual:
            cur.execute(
                "SELECT COUNT(*) FROM collection_cards WHERE collection_id=%s;", (global_id,)
            )
            count = cur.fetchone()[0]
            if count == 0:
                new_state = 0
            elif count <= 10:
                new_state = 1
            elif count <= 25:
                new_state = 3
            elif count <= 50:
                new_state = 4
            elif count <= 100:
                new_state = 5
            elif count <= 200:
                new_state = 6
            else:
                new_state = 7
            cur.execute(
                "UPDATE collections SET card_stack_state_index=%s WHERE id=%s;",
                (new_state, global_id),
            )
            conn.commit()

        cur.close()
        return (
            jsonify(
                {"message": "Card added to collection", "collection_card_id": collection_card_id}
            ),
            201,
        )
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": "Error adding card", "error": str(e)}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)


from flask import jsonify, current_app
from flask_cors import cross_origin
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

@collections_bp.route(
    "/<string:username>/collection/<int:user_collection_id>/cards",
    methods=["GET"]
)
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
def list_cards_in_collection(username: str, user_collection_id: int):
    """
    List cards in a collection (public if is_public=True, otherwise owner-only)
    ---
    tags: [Collection Cards]
    parameters:
      - name: username
        in: path
        required: true
        type: string
      - name: user_collection_id
        in: path
        required: true
        type: integer
    responses:
      200:
        description: Array of cards
        schema:
          type: array
          items: {$ref: '#/definitions/CollectionCard'}
      401: {description: Unauthorized}
      403: {description: Forbidden}
      404: {description: Collection not found}
      500: {description: Server error}
    """
    conn = pg_pool.getconn()
    try:
        # 1) Lookup the collection’s DB id, its is_public flag, and its owner
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.id, c.is_public, c.user_id
            FROM collections c
            JOIN users u ON u.id = c.user_id
            WHERE u.username = %s
              AND c.user_collection_id = %s;
            """,
            (username, user_collection_id),
        )
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"message": "Collection not found"}), 404

        global_id, is_public, owner_id = row

        # 2) If private → enforce JWT + owner check
        if not is_public:
            try:
                verify_jwt_in_request()
            except Exception as err:
                current_app.logger.debug(f"verify_jwt failed in list_cards: {err}")
                return jsonify({"message": "Unauthorized"}), 401

            user_id = get_jwt_identity()
            current_app.logger.debug(f"JWT identity (user_id): {user_id}, owner_id: {owner_id}")
            if user_id != owner_id:
                return jsonify({"message": "Forbidden"}), 403

        # 3) Finally, fetch the cards
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cc.id, cc.card_id, cc.added_at,
                   c.name, c.set, c.set_name, c.lang, c.layout, c.image_uris
            FROM collection_cards cc
            JOIN cards c ON cc.card_id = c.id
            WHERE cc.collection_id = %s;
            """,
            (global_id,),
        )
        rows = cur.fetchall()
        cur.close()

        cards = [
            {
                "id":           r[0],
                "card_id":      r[1],
                "added_at":     r[2],
                "name":         r[3],
                "set":          r[4],
                "set_name":     r[5],
                "lang":         r[6],
                "layout":       r[7],
                "image_uris":   r[8],
            }
            for r in rows
        ]

        return jsonify(cards), 200

    except Exception as e:
        if conn:
            conn.rollback()
        current_app.logger.exception("Error retrieving cards")
        return jsonify({"message": "Error retrieving cards", "error": str(e)}), 500

    finally:
        if conn:
            pg_pool.putconn(conn)


@collections_bp.route(
    "/<string:username>/collection/<int:user_collection_id>/cards/<int:collection_card_id>",
    methods=["DELETE"],
)
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
@jwt_required
def delete_card_from_collection(username, user_collection_id, collection_card_id):
    """
    Remove a card from a collection
    ---
    tags: [Collection Cards]
    security: [{BearerAuth: []}]
    parameters:
      - {name: username, in: path, required: true, type: string}
      - {name: user_collection_id, in: path, required: true, type: integer}
      - {name: collection_card_id, in: path, required: true, type: integer}
    responses:
      200: {description: Card removed}
      401: {description: Unauthorized}
      404: {description: Card or collection not found}
      500: {description: Server error}
    """
    user_id = request.user.get("user_id")
    conn = None
    try:
        conn = pg_pool.getconn()
        global_id = get_global_collection_id(user_id, user_collection_id, conn)
        if not global_id:
            return jsonify({"message": "Collection not found"}), 404

        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM collection_cards
            WHERE id = %s AND collection_id = %s;
            """,
            (collection_card_id, global_id),
        )
        deleted = cur.rowcount
        conn.commit()
        cur.close()

        if deleted == 0:
            return jsonify({"message": "Card not found"}), 404
        return jsonify({"message": "Card removed from collection"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"message": "Error deleting card", "error": str(e)}), 500
    finally:
        if conn:
            pg_pool.putconn(conn)

@collections_bp.route("/<string:username>/collection/<int:user_collection_id>/bulk-add", methods=["POST"])
@cross_origin(
    supports_credentials=True,
    origins=["https://mtgscan.cards"],
    methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)
@jwt_required
def bulk_add_cards(username, user_collection_id):
    """
    Add multiple cards to a collection from MTG text input format.
    ---
    tags: [Collection Cards]
    security: [{BearerAuth: []}]
    parameters:
      - name: username
        in: path
        required: true
        type: string
      - name: user_collection_id
        in: path
        required: true
        type: integer
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            text:
              type: string
              example: "2 Lightning Bolt (LEA) 116\\n3 Llanowar Elves (M21) 199"
            lang:
              type: string
              example: "en"
    responses:
      200:
        description: Cards processed
        schema:
          type: object
          properties:
            added:
              type: integer
            failed:
              type: integer
      401: {description: Unauthorized}
    """
    import re
    from flask import current_app, request, jsonify

    user_id = request.user.get("user_id")
    data = request.get_json()
    lines = data.get("text", "").splitlines()
    lang = data.get("lang", "en").lower()

    added = 0
    failed = 0

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()

        # Validate collection ownership
        cur.execute(
            "SELECT id FROM collections WHERE user_id = %s AND user_collection_id = %s",
            (user_id, user_collection_id),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"message": "Collection not found"}), 404
        collection_id = row[0]

        for line in lines:
            match = re.match(r"(\d+)\s+(.*?)\s+\((\w+)\)\s+(\d+)", line.strip())
            if not match:
                current_app.logger.warning(f"[bulk-add] Regex failed: {line.strip()}")
                failed += 1
                continue

            qty_str, name, set_code, collector = match.groups()
            qty = int(qty_str)
            normalized_name = name.strip()
            set_code = set_code.lower()
            collector_number = collector.lstrip("0")  # ← Key fix

            current_app.logger.debug(
                f"[bulk-add] Parsed → qty: {qty}, name: {normalized_name}, set: {set_code}, collector: {collector_number}, lang: {lang}"
            )

            # Try direct name match
            cur.execute(
                """
                SELECT id FROM cards
                WHERE set = %s AND collector_number = %s AND lang = %s
                  AND name ILIKE %s
                LIMIT 1;
                """,
                (set_code, collector_number, lang, normalized_name),
            )
            card = cur.fetchone()

            # Try card_faces[0].name match
            if not card:
                cur.execute(
                    """
                    SELECT id FROM cards
                    WHERE set = %s AND collector_number = %s AND lang = %s
                      AND (card_faces->0->>'name') ILIKE %s
                    LIMIT 1;
                    """,
                    (set_code, collector_number, lang, normalized_name),
                )
                card = cur.fetchone()

            if not card:
                current_app.logger.warning(
                    f"[bulk-add] Not found: name='{normalized_name}', set='{set_code}', collector='{collector_number}', lang='{lang}'"
                )
                failed += 1
                continue

            card_id = card[0]
            for _ in range(qty):
                cur.execute(
                    """
                    INSERT INTO collection_cards (collection_id, card_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id;
                    """,
                    (collection_id, card_id),
                )
                if cur.fetchone():
                    added += 1

        conn.commit()
        return jsonify({"added": added, "failed": failed})

    except Exception as e:
        conn.rollback()
        current_app.logger.exception("Error during bulk add")
        return jsonify({"message": "Failed to add cards", "error": str(e)}), 500

    finally:
        pg_pool.putconn(conn)

