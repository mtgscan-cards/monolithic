import os

# ─── Database ───────────────────────────────────────────────────────────────
POSTGRES_CONFIG = {
    "user":     os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host":     os.getenv("POSTGRES_HOST"),
    "port":     os.getenv("POSTGRES_PORT"),
    "database": os.getenv("POSTGRES_DB"),
}

# ─── hCaptcha ───────────────────────────────────────────────────────────────
HCAPTCHA_SECRET = os.getenv("HCAPTCHA_SECRET")

# ─── Google Identity Services (Sign‑in with Google) ─────────────────────────
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")           # e.g. 12345‑abc.apps.googleusercontent.com

# ─── Login throttling ───────────────────────────────────────────────────────
FAILED_ATTEMPTS_THRESHOLD_BACKOFF = int(os.getenv("FAILED_ATTEMPTS_THRESHOLD_BACKOFF", 3))
FAILED_ATTEMPTS_THRESHOLD_BAN     = int(os.getenv("FAILED_ATTEMPTS_THRESHOLD_BAN", 5))
BACKOFF_DURATION                  = int(os.getenv("BACKOFF_DURATION", 10))   # seconds
BAN_DURATION                      = int(os.getenv("BAN_DURATION", 300))      # seconds

# ─── JWT signing ────────────────────────────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "your-very-secure-secret")  # replaced in production
JWT_ALGORITHM = "HS256"

GITHUB_APP_CLIENT_ID     = os.getenv("GITHUB_APP_CLIENT_ID")
GITHUB_APP_CLIENT_SECRET = os.getenv("GITHUB_APP_CLIENT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://mtgscan.cards")
REFRESH_TOKEN_EXPIRE_DAYS = os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30)  # days


# ─── Flask-JWT-Extended configuration ─────────────────────────────────────
JWT_SECRET_KEY          = JWT_SECRET
JWT_TOKEN_LOCATION      = ["headers", "cookies"]
JWT_IDENTITY_CLAIM      = "user_id"
JWT_ACCESS_COOKIE_NAME  = "access_token"
JWT_REFRESH_COOKIE_NAME = "refresh_token"
JWT_COOKIE_CSRF_PROTECT = False