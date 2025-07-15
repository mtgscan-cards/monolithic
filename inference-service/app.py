from flask import Flask, jsonify
from flask_cors import CORS
from flasgger import Swagger
from dotenv import load_dotenv
from logging.handlers import TimedRotatingFileHandler
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import os
import sys
import redis
from utils.resource_manager import load_resources
from utils.scryfall_bootstrap import ensure_scryfall_json_present
from config import LOG_FILE_PATH, LOG_LEVEL
from routes.infer_routes import infer_bp
from scryfall_update.update import main as scryfall_update_main
from descriptor_update.descriptor_update import run_descriptor_update_pipeline
from db.init_tables import (
    init_auth_tables,
    init_security_tables,
    init_collection_tables,
    init_mobile_scan_tables,
    init_landing_cards_table,
    build_tag_cache,
)

# ─── Load environment variables ────────────────────────────────────────
load_dotenv()

# ─── Logging setup ─────────────────────────────────────────────────────
handlers = []

if LOG_FILE_PATH:
    os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)
    file_handler = TimedRotatingFileHandler(
        LOG_FILE_PATH, when="midnight", interval=1, backupCount=0, utc=True
    )
    file_handler.suffix = "%Y-%m-%d"
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))
    handlers.append(file_handler)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
))
handlers.append(stream_handler)

logging.basicConfig(
    level=LOG_LEVEL,
    handlers=handlers,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    force=True
)

logger = logging.getLogger(__name__)
logger.info("inference-service logging initialized.")

# ─── Flask App Setup ────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, supports_credentials=True)

# ─── Blueprint Registration ────────────────────────────────────────────
app.register_blueprint(infer_bp)

# ─── Swagger Documentation ─────────────────────────────────────────────
swagger = Swagger(app, template={
    "swagger": "2.0",
    "info": {
        "title": "Inference API",
        "description": "Endpoints for descriptor-based inference",
        "version": "1.0.0"
    },
    "basePath": "/",
    "schemes": ["http"],
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization"
        }
    }
})

# ─── Safe Scheduled Model Update ───────────────────────────────────────
def safe_model_update():
    r = redis.Redis(host=os.getenv("REDIS_HOST", "mtg-redis"), port=6379)
    lock = r.lock("model_update_lock", timeout=1800)
    if lock.acquire(blocking=False):
        try:
            logger.info("[scheduler] Acquired lock — running Scryfall + descriptor update.")
            scryfall_update_main()
            run_descriptor_update_pipeline()
            logger.info("[scheduler] Update complete.")
        finally:
            lock.release()
    else:
        logger.info("[scheduler] Skipping update — another worker is running.")

scheduler = BackgroundScheduler()
scheduler.add_job(safe_model_update, trigger="cron", hour=2)
scheduler.start()

# ─── Health Check ──────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def root_health_check():
    return jsonify({
        "status": "ok",
        "service": "inference-service",
        "docs_url": "/apidocs"
    }), 200

# ─── Main Entrypoint ───────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("inference-service starting...")
    
    ensure_scryfall_json_present()
    load_resources()
    init_auth_tables()
    init_security_tables()
    init_collection_tables()
    init_mobile_scan_tables()
    init_landing_cards_table()
    build_tag_cache()

    app.run(debug=True, threaded=True, host="0.0.0.0", port=5001)
