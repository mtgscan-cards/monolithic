# routes/auth/services.py

import datetime

from jwt_helpers import create_access_token, create_refresh_token

def issue_tokens(
    cur,
    *,
    user_id: int,
    username: str,
    google_linked: bool,
    github_linked: bool,
    has_password: bool,
    display_name: str,
    avatar_url: str
) -> dict:
    """
    Create a new access + refresh token pair for the given user,
    persist the refresh token in the database, and return the payload.
    """
    # Prepare JWT payload
    payload = {
        "user_id":       user_id,
        "username":      username,
        "google_linked": google_linked,
        "github_linked": github_linked,
        "has_password":  has_password,
        "display_name":  display_name,
        "avatar_url":    avatar_url,
    }

    # Generate tokens
    access_token  = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    # Persist the refresh token
    cur.execute(
        """
        INSERT INTO tokens (token_hash, user_id, expires_at)
        VALUES (%s, %s, %s)
        """,
        (
            refresh_token,
            user_id,
            datetime.datetime.utcnow() + datetime.timedelta(days=90),
        ),
    )

    # Return everything the handlers expect
    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        **payload,
    }