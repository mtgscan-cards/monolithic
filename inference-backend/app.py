from config import FRONTEND_URL, JWT_COOKIE_DOMAIN
import config
from werkzeug.middleware.proxy_fix import ProxyFix
from scryfall_update.update import main as update_main
from db.postgres_pool import pg_pool
from routes.mobile_infer_routes import mobile_infer_bp
from routes.collection_value_routes import collection_value_bp
from routes.collections_routes import collections_bp
from routes.auth import auth_bp
from routes.infer_routes import infer_bp
from routes.search_routes import search_bp
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
from datetime import datetime, timezone, timedelta
import json
from flask_apscheduler import APScheduler
from flask_cors import CORS
from flask import Flask
from flasgger import Swagger
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import os
import sys
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager

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

logging.basicConfig(level=log_level, handlers=handlers)
logger = logging.getLogger(__name__)
logger.info("Daily log rotation is active.")

app = Flask(__name__)

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
app.register_blueprint(infer_bp)
app.register_blueprint(collections_bp)
app.register_blueprint(collection_value_bp)
app.register_blueprint(mobile_infer_bp)

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

# ─── DB initialisation helpers ───────────────────────────────────────────────


def init_auth_tables():
    """
    Creates auth-related tables (users, tokens, recovery_codes) if they don't exist.
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()

        # users table
        cur.execute("SELECT to_regclass('public.users');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE users (
                id            SERIAL PRIMARY KEY,
                email         VARCHAR(255) UNIQUE NOT NULL,
                username      VARCHAR(64)  UNIQUE,
                full_name     TEXT,
                picture_url   TEXT,
                locale        VARCHAR(10),
                password_hash TEXT,
                google_sub    VARCHAR(255) UNIQUE,
                github_id     BIGINT        UNIQUE,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            );
            """)

        # tokens table
        cur.execute("SELECT to_regclass('public.tokens');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                expires_at  TIMESTAMPTZ,
                revoked     BOOLEAN DEFAULT FALSE
            );
            """)

        # recovery_codes table
        cur.execute("SELECT to_regclass('public.recovery_codes');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE recovery_codes (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_hash  TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                used       BOOLEAN DEFAULT FALSE
            );
            """)

        conn.commit()
        logger.info("Authentication tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring auth tables:", e)
    finally:
        pg_pool.putconn(conn)


def init_security_tables():
    """
    Creates security-related tables if they don't exist.
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.login_attempts');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE login_attempts (
                ip            VARCHAR(45) PRIMARY KEY,
                attempt_count INTEGER     DEFAULT 0,
                banned_until  TIMESTAMPTZ,
                last_attempt  TIMESTAMPTZ DEFAULT NOW()
            );
            """)
            conn.commit()
            logger.info("Security tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring security tables:", e)
    finally:
        pg_pool.putconn(conn)


def init_collection_tables():
    """
    Creates collections and related tables if they don't exist.
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT to_regclass('public.collections');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collections (
                id                     SERIAL PRIMARY KEY,
                user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                label                  VARCHAR(255) NOT NULL,
                card_stack_state_index INTEGER NOT NULL,
                color_top              INTEGER NOT NULL,
                color_bottom           INTEGER NOT NULL,
                is_public              BOOLEAN DEFAULT FALSE,
                is_manual_state        BOOLEAN DEFAULT FALSE,
                user_collection_id     INTEGER NOT NULL,
                created_at             TIMESTAMPTZ DEFAULT NOW()
            );
            """)
            cur.execute("""
            CREATE UNIQUE INDEX idx_user_collection
            ON collections (user_id, user_collection_id);
            """)

        cur.execute("SELECT to_regclass('public.collection_cards');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collection_cards (
                id            SERIAL PRIMARY KEY,
                collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                card_id       UUID    NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
                added_at      TIMESTAMPTZ DEFAULT NOW()
            );
            """)

        cur.execute("SELECT to_regclass('public.collection_price_snapshots');")
        if cur.fetchone()[0] is None:
            cur.execute("""
            CREATE TABLE collection_price_snapshots (
                id                  SERIAL PRIMARY KEY,
                collection_card_id  INTEGER NOT NULL REFERENCES collection_cards(id) ON DELETE CASCADE,
                snapshot_date       DATE    NOT NULL,
                prices              JSONB,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_snapshot
                  UNIQUE (collection_card_id, snapshot_date)
            );
            """)

        conn.commit()
        logger.info("Collection tables ensured.")
    except Exception as e:
        conn.rollback()
        logger.error("Error ensuring collection tables:", e)
    finally:
        pg_pool.putconn(conn)


def build_tag_cache():
    """
    Builds tags_cache.json if it doesn't already exist.
    """
    cache_path = 'tags_cache.json'
    if os.path.exists(cache_path):
        logger.info("Tag cache already exists; skipping build.")
        return

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT keyword, COUNT(*) AS count
            FROM (
                SELECT jsonb_array_elements_text(keywords) AS keyword
                FROM cards
                WHERE keywords IS NOT NULL
                  AND lang = 'en'
                  AND edhrec_rank IS NOT NULL
            ) sub
            GROUP BY keyword
            ORDER BY count DESC
            LIMIT 40;
        """)
        tags = [{'keyword': row[0], 'count': row[1]} for row in cur.fetchall()]
        with open(cache_path, 'w') as f:
            json.dump({"tags": tags}, f)
        logger.info("Tag cache built.")
    except Exception as e:
        logger.error("Error building tag cache:", e)
    finally:
        pg_pool.putconn(conn)

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


def job_listener(event):
    job = scheduler.get_job('daily_scryfall_update')
    if event.exception:
        logger.info("Database update job encountered an error.")
    else:
        next_run = job.next_run_time.strftime(
            "%Y-%m-%d %H:%M:%S") if job.next_run_time else "unknown"
        print(
            f"Database update complete. Next update scheduled for {next_run}.")


scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
scheduler.add_job(
    id='daily_scryfall_update',
    func=update_main,
    trigger='cron',
    hour=0,
    minute=0
)


def init_mobile_scan_tables():
    """
    Creates or updates mobile scan session and result tables for mobile scan offloading.
    Ensures that all expected columns are present.
    """
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()

        # ── Session Table ─────────────────────────────────────────────
        cur.execute("SELECT to_regclass('public.mobile_scan_sessions');")
        if cur.fetchone()[0] is None:
            cur.execute("""
                CREATE TABLE mobile_scan_sessions (
                    id UUID PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
                    completed BOOLEAN DEFAULT FALSE,
                    result JSONB
                );
            """)
            logger.info("✅ mobile_scan_sessions table created.")
        else:
            # Ensure missing columns are added (ALTER TABLE is idempotent if column already exists)
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='mobile_scan_sessions' AND column_name='completed'
                    ) THEN
                        ALTER TABLE mobile_scan_sessions ADD COLUMN completed BOOLEAN DEFAULT FALSE;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='mobile_scan_sessions' AND column_name='result'
                    ) THEN
                        ALTER TABLE mobile_scan_sessions ADD COLUMN result JSONB;
                    END IF;
                END
                $$;
            """)
            logger.info(
                "✅ mobile_scan_sessions table updated with missing columns.")

        # ── Result Table ──────────────────────────────────────────────
        cur.execute("SELECT to_regclass('public.mobile_scan_results');")
        if cur.fetchone()[0] is None:
            cur.execute("""
                CREATE TABLE mobile_scan_results (
                    id UUID PRIMARY KEY,
                    session_id UUID NOT NULL REFERENCES mobile_scan_sessions(id) ON DELETE CASCADE,
                    result JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            logger.info("✅ mobile_scan_results table created.")

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("❌ Error ensuring mobile scan tables:", e)
    finally:
        pg_pool.putconn(conn)


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

# ─── Initialise everything & start ────────────────────────────────────────────
init_auth_tables()
init_security_tables()
init_collection_tables()
init_mobile_scan_tables()
build_tag_cache()

update_main()  # download scryfall bulk data and populate the database

if __name__ == '__main__':
    logger.info("Flask app starting…")
    app.run(debug=True, threaded=True, port=5000)
    logger.info(
        "Flask app is now running and ready to accept requests at http://127.0.0.1:5000")
