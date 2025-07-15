import os

POSTGRES_CONFIG = {
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": os.getenv("POSTGRES_PORT", 5432),
    "database": os.getenv("POSTGRES_DB", "mtgscan"),
    "minconn": int(os.getenv("POSTGRES_MIN_CONN", 1)),
    "maxconn": int(os.getenv("POSTGRES_MAX_CONN", 5)),
}


LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "/app/logs/inference-service.log")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
