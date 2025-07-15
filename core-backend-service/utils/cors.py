from config import FRONTEND_URL

def get_cors_origin():
    return {
        "supports_credentials": True,
        "origins": [FRONTEND_URL],
        "methods": ["GET", "POST", "OPTIONS", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
