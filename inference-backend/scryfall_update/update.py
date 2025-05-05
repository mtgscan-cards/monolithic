import os
import decimal
import time
import random
from datetime import datetime, timezone

import requests
import psycopg2.extras
import ijson
from filelock import FileLock, Timeout

from db.postgres_pool import pg_pool

# ---------------------------
# CONFIGURATION
# ---------------------------
BULK_DATA_TYPE = "all_prints"

ALLOWED_LAYOUTS = {
    'normal', 'split', 'flip', 'transform', 'modal_dfc', 'meld', 'leveler',
    'class', 'case', 'saga', 'adventure', 'mutate', 'prototype', 'battle',
    'planar', 'scheme', 'vanguard', 'token', 'double_faced_token', 'emblem',
    'augment', 'host', 'art_series', 'reversible_card'
}

columns = [
    "oracle_id", "id", "object", "multiverse_ids", "mtgo_id", "tcgplayer_id", "cardmarket_id", "name",
    "lang", "released_at", "uri", "scryfall_uri", "layout", "highres_image", "image_status", "image_uris",
    "mana_cost", "cmc", "type_line", "oracle_text", "power", "toughness", "colors", "color_identity",
    "keywords", "legalities", "games", "reserved", "game_changer", "foil", "nonfoil", "finishes", "oversized",
    "promo", "reprint", "variation", "set_id", "set", "set_name", "set_type", "set_uri", "set_search_uri",
    "scryfall_set_uri", "rulings_uri", "prints_search_uri", "collector_number", "digital", "rarity",
    "watermark", "flavor_text", "card_back_id", "artist", "artist_ids", "illustration_id", "border_color",
    "frame", "frame_effects", "security_stamp", "full_art", "textless", "booster", "story_spotlight",
    "edhrec_rank", "preview", "prices", "related_uris", "purchase_uris", "card_faces"
]

set_columns = [
    "id", "code", "name", "uri", "scryfall_uri", "search_uri", "released_at", "set_type", "card_count",
    "parent_set_code", "digital", "nonfoil_only", "foil_only", "icon_svg_uri"
]

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str).date()
    except ValueError:
        return None

def convert_decimals(obj):
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    else:
        return obj

def process_card(card):
    layout = card.get("layout")
    if layout not in ALLOWED_LAYOUTS:
        print(f"Warning: Unexpected layout '{layout}' for card {card.get('name')}")
    if "card_faces" in card and not card.get("image_uris"):
        aggregated = [face["image_uris"] for face in card["card_faces"] if "image_uris" in face]
        if aggregated:
            card["image_uris"] = aggregated
    processed = {}
    for col in columns:
        val = card.get(col)
        if col == "released_at":
            processed[col] = parse_date(val)
        else:
            if isinstance(val, decimal.Decimal):
                processed[col] = float(val)
            elif isinstance(val, (dict, list)):
                processed[col] = psycopg2.extras.Json(convert_decimals(val))
            else:
                processed[col] = val
    return processed

def upsert_batch(data_batch):
    conn = pg_pool.getconn()
    try:
        cursor = conn.cursor()
        update_columns = [col for col in columns if col != "id"]
        set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in update_columns)
        sql = f"""
        INSERT INTO cards ({', '.join(columns)}) VALUES %s
        ON CONFLICT (id) DO UPDATE SET {set_clause}
        """
        psycopg2.extras.execute_values(cursor, sql, data_batch, template=None, page_size=1000)
        conn.commit()
        cursor.close()
    finally:
        pg_pool.putconn(conn)

def process_set(set_data):
    processed = {}
    for col in set_columns:
        val = set_data.get(col)
        if col == "released_at":
            processed[col] = parse_date(val)
        else:
            processed[col] = val
    return processed

def upsert_sets_batch(data_batch):
    conn = pg_pool.getconn()
    try:
        cursor = conn.cursor()
        update_columns = [col for col in set_columns if col != "id"]
        set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in update_columns)
        sql = f"""
        INSERT INTO sets ({', '.join(set_columns)}) VALUES %s
        ON CONFLICT (id) DO UPDATE SET {set_clause}
        """
        psycopg2.extras.execute_values(cursor, sql, data_batch, template=None, page_size=1000)
        conn.commit()
        cursor.close()
    finally:
        pg_pool.putconn(conn)

def import_sets():
    sets_url = "https://api.scryfall.com/sets"
    print(f"Downloading sets from {sets_url}")
    resp = requests.get(sets_url, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to download sets: {resp.status_code}")
    sets_json = resp.json()
    sets_list = sets_json.get("data", [])
    print(f"Processing {len(sets_list)} sets...")
    batch = []
    for set_item in sets_list:
        processed = process_set(set_item)
        if not processed.get("id"):
            continue
        row = tuple(processed.get(col) for col in set_columns)
        batch.append(row)
    if batch:
        upsert_sets_batch(batch)
        print(f"Upserted {len(batch)} sets.")

def download_latest_json(json_file):
    bulk_api = "https://api.scryfall.com/bulk-data"
    print(f"Checking Scryfall API for {BULK_DATA_TYPE}...")
    resp = requests.get(bulk_api, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed API request: {resp.status_code}")
    bulk_data = resp.json().get("data", [])
    desired_type = BULK_DATA_TYPE if BULK_DATA_TYPE != "all_prints" else "all_cards"
    desired_bulk = next((item for item in bulk_data if item.get("type") == desired_type), None)
    if not desired_bulk:
        raise RuntimeError(f"{BULK_DATA_TYPE} not found in bulk data.")
    server_updated_at = datetime.fromisoformat(desired_bulk.get("updated_at").replace("Z", "+00:00"))
    download_uri = desired_bulk.get("download_uri")
    if os.path.exists(json_file):
        local_mtime = datetime.fromtimestamp(os.path.getmtime(json_file), tz=timezone.utc)
        if local_mtime >= server_updated_at:
            print("Local data is up to date.")
            return
    r = requests.get(download_uri, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to download: {r.status_code}")
    with open(json_file, "wb") as f:
        f.write(r.content)
    os.utime(json_file, (server_updated_at.timestamp(), server_updated_at.timestamp()))
    print(f"Downloaded and saved {json_file}")

def is_card_table_populated():
    conn = pg_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM cards")
            return cur.fetchone()[0] > 0
    finally:
        pg_pool.putconn(conn)

def main():
    if is_card_table_populated():
        print("Cards already exist in the database. Skipping import.")
        return

    json_file = f"scryfall-{BULK_DATA_TYPE}.json"
    download_latest_json(json_file)
    batch_size = 10000
    batch = []
    total_count = 0
    print("Processing cards...")
    with open(json_file, 'rb') as f:
        cards = ijson.items(f, 'item')
        for card in cards:
            processed = process_card(card)
            if not processed.get("id"):
                continue
            row = tuple(processed.get(col) for col in columns)
            batch.append(row)
            total_count += 1
            if total_count % batch_size == 0:
                print(f"Upserting {total_count} cards...")
                upsert_batch(batch)
                batch = []
    if batch:
        upsert_batch(batch)
    print(f"Finished processing {total_count} cards.")
    import_sets()

# Lock and random delay for concurrency safety
if __name__ == "__main__":
    LOCK_PATH = "/tmp/scryfall_import.lock"
    time.sleep(random.uniform(0, 5))  # Random delay to prevent race condition
    try:
        with FileLock(LOCK_PATH, timeout=0):
            main()
    except Timeout:
        print("Another process is already importing data. Skipping.")