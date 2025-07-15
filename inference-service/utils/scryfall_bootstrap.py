import os
import logging
from scryfall_update import update

logger = logging.getLogger(__name__)

def ensure_scryfall_json_present():
    bulk_type = "all_prints"
    data_dir = os.getenv("SCRYFALL_DATA_DIR", "data")
    os.makedirs(data_dir, exist_ok=True)

    json_path = os.path.join(data_dir, f"scryfall-{bulk_type}.json")

    if os.path.exists(json_path):
        logger.info(f"✅ Scryfall bulk JSON already present at {json_path}.")
        return

    logger.warning(f"⚠️ Scryfall JSON missing at {json_path} — running update.main() to download and initialize.")
    try:
        update.main()
    except Exception as e:
        logger.error(f"❌ Failed to bootstrap Scryfall data: {e}", exc_info=True)
        raise
