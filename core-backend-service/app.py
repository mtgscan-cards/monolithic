from config import FRONTEND_URL, JWT_COOKIE_DOMAIN
import config
from werkzeug.middleware.proxy_fix import ProxyFix
from db.postgres_pool import pg_pool
from routes.collection_value_routes import collection_value_bp
from routes.collections_routes import collections_bp
from routes.auth import auth_bp
from routes.descriptor_proxy import descriptor_proxy_bp
from routes.search_routes import search_bp
from datetime import timedelta
import json
from flask_apscheduler import APScheduler
from flask_cors import CORS
from flask import Flask, jsonify
from flasgger import Swagger
import logging
from logging.handlers import TimedRotatingFileHandler
import os
import sys
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager
from extensions import limiter

load_dotenv()  # Reads variables from .env


log_path = os.getenv("LOG_FILE_PATH", "/app/logs/app.log")
log_level = os.getenv("LOG_LEVEL", "INFO").upper()

handlers = []

# File logging (rotate daily)
# Use the following cron job to delete old logs on the server:
# 0 3 * * * find /path/to/logs -name "app.log.*" -mtime +7 -delete
if log_path:
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    file_handler = TimedRotatingFileHandler(
        log_path,
        when="midnight",       # Rotate daily
        interval=1,
        backupCount=0,         # Let cron handle cleanup
        utc=True               # Optional: use UTC timestamps
    )
    file_handler.suffix = "%Y-%m-%d"
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))
    handlers.append(file_handler)

# Stdout logging (Docker-safe)
stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
))
handlers.append(stream_handler)

log_level = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=handlers,
    force=True  # Clears duplicate handlers reliably
)

logger = logging.getLogger(__name__)
logger.info("Daily log rotation is active.")

app = Flask(__name__)

# Set up the rate limiter using Redis (network name matches docker-compose)
limiter.init_app(app)

# Tell Flask to trust proxy headers like X-Forwarded-Proto
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# load your other config values first…
app.config.from_object('config')    # or however you load your base config

# ─── HERE is where you add all the JWT-Extended settings ────────────────
# ─── HERE is where you add all the JWT-Extended settings ────────────────
app.config['JWT_SECRET_KEY'] = app.config['JWT_SECRET']
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
app.config['JWT_IDENTITY_CLAIM'] = 'user_id'
app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token'
app.config['JWT_REFRESH_COOKIE_NAME'] = 'refresh_token'
app.config['JWT_COOKIE_CSRF_PROTECT'] = False

# ─── Required for cross-site cookie usage ────────────────
is_production = os.environ.get("FLASK_ENV") == "production"

app.config['JWT_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['JWT_COOKIE_SECURE'] = True if is_production else False
if JWT_COOKIE_DOMAIN:
    app.config["JWT_COOKIE_DOMAIN"] = JWT_COOKIE_DOMAIN

# now initialize the JWT extension
jwt = JWTManager(app)

# ─── session & CORS settings ───────────────────────────────────────────
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your-secret-key')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
CORS(app, supports_credentials=True, origins=[FRONTEND_URL])

# ─── Blueprint registration ──────────────────────────────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(search_bp)

app.register_blueprint(descriptor_proxy_bp)
app.register_blueprint(collections_bp)
app.register_blueprint(collection_value_bp)


# ─── Swagger docs ────────────────────────────────────────────────────────────

swagger = Swagger(app, template={
    "swagger": "2.0",
    "info": {
        "title": "api.mtgscan.cards API docs",
        "description": "Documentation of all endpoints",
        "version": "1.0.0"
    },
    "basePath": "/",
    "schemes": ["http"],
    "definitions": {
        "Color": {
            "type": "object",
            "properties": {
                "top": {"type": "integer", "example": 16777215},
                "bottom": {"type": "integer", "example": 9109504}
            }
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
                "is_manual_state": {"type": "boolean"}
            }
        },
        "CollectionCard": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "card_id": {"type": "string"},
                "name": {"type": "string"},
                "set": {"type": "string"},
                "set_name": {"type": "string"},
                "lang": {"type": "string"},
                "layout": {"type": "string"},
                "image_uris": {"type": "object"},
                "added_at": {"type": "string", "format": "date-time"}
            }
        },
        "TokenResponse": {
            "type": "object",
            "properties": {
                "access_token": {"type": "string"},
                "refresh_token": {"type": "string"},
                "username": {"type": "string"},
                "display_name": {"type": "string"},
                "avatar_url": {"type": "string"},
                "google_linked": {"type": "boolean"},
                "github_linked": {"type": "boolean"},
                "has_password": {"type": "boolean"}
            }
        },
        "BasicResponse": {
            "type": "object",
            "properties": {
                "message": {"type": "string"}
            }
        },
        "ErrorResponse": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "error": {"type": "string"}
            }
        }
    },
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization"
        }
    }
})


# ─── Scheduler ───────────────────────────────────────────────────────────────


class Config:
    SCHEDULER_API_ENABLED = True
    SCHEDULER_EXECUTORS = {
        'default':    {'type': 'threadpool',  'max_workers': 10},
        'processpool': {'type': 'processpool', 'max_workers': 2},
    }
    SCHEDULER_JOB_DEFAULTS = {
        'coalesce': False,
        'max_instances': 1,
    }


app.config.from_object(Config())
scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()




def take_collection_price_snapshot():
    """
    Insert a new price snapshot for each card in collections if:
      - There is no snapshot for today, or
      - The current price in the cards table is different from the last recorded snapshot.
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        sql = """
            INSERT INTO collection_price_snapshots (collection_card_id, snapshot_date, prices)
            SELECT cc.id, CURRENT_DATE, c.prices
            FROM collection_cards cc
            JOIN cards c ON cc.card_id = c.id
            LEFT JOIN LATERAL (
                SELECT prices 
                FROM collection_price_snapshots 
                WHERE collection_card_id = cc.id 
                ORDER BY snapshot_date DESC LIMIT 1
            ) last_snapshot ON TRUE
            WHERE last_snapshot.prices IS NULL 
               OR last_snapshot.prices IS DISTINCT FROM c.prices;
        """
        cur.execute(sql)
        conn.commit()
        cur.close()
        logger.info(
            "Daily collection price snapshots taken where changes were detected.")
    except Exception as e:
        logger.error("Error taking collection price snapshot:", e)
    finally:
        pg_pool.putconn(conn)


scheduler.add_job(
    id='daily_collection_price_snapshot',
    func=take_collection_price_snapshot,
    trigger='cron',
    hour=1,   # Adjust the time to run after daily price updates have been applied
    minute=0
)

# ─── Health check route at baseurl ────────────────────────────────────────────
@app.route('/', methods=['GET'])
@limiter.limit("10 per minute")
def root_health_check():
    return jsonify({
        "status": "ok",
        "service": "mtgscan-api",
        "docs_url": "/apidocs"
    }), 200

if __name__ == '__main__':
    logger.info("Flask app starting…")
    app.run(debug=True, threaded=True, port=5000)
    logger.info(
        "Flask app is now running and ready to accept requests at http://127.0.0.1:5000")
