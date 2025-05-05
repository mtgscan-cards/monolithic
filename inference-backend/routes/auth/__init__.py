from flask import Blueprint

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")

# now that handlers/ is a proper package, this will work:
from .handlers import (
    captcha,
    user,
    password,
    oauth_google,
    oauth_github,
    recovery,
    tokens,
)