from flask import Blueprint

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")

# Ensure all handler routes are registered before blueprint registration
from .handlers import (
    captcha,
    user,
    password,
    oauth_google,
    oauth_github,
    recovery,
    tokens,
)