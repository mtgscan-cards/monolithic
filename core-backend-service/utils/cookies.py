# utils/cookies.py

from flask import current_app

# 30 days in seconds
_REFRESH_MAX_AGE = 30 * 24 * 60 * 60

def set_refresh_cookie(resp, token: str):
    """
    Sets the refresh-token cookie with attributes appropriate to dev vs prod:

    In development (DEBUG=True):
      • secure=False       (so plain HTTP works)
      • samesite="Lax"     (same-site XHR sends it)
      • httponly=True
      • path="/"

    In production (DEBUG=False):
      • secure=True        (HTTPS only)
      • samesite="None"    (cross-site XHR allowed)
      • httponly=True
      • path="/"
    """
    if current_app.debug:
        # Development: no HTTPS required, same-site cookie
        resp.set_cookie(
            "refresh_token",
            token,
            max_age=_REFRESH_MAX_AGE,
            httponly=True,
            secure=False,
            samesite="Lax",
            path="/",
        )
    else:
        # Production: require HTTPS, allow cross-site
        resp.set_cookie(
            "refresh_token",
            token,
            max_age=_REFRESH_MAX_AGE,
            httponly=True,
            secure=True,
            samesite="None",
            path="/",
        )