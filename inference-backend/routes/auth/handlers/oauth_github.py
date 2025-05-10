import datetime
import secrets
import urllib.parse

from flask import jsonify, redirect, request, session, url_for, make_response, current_app
from jwt_helpers import jwt_required
from .. import auth_bp
from ..services import issue_tokens
from db.postgres_pool import pg_pool
from config import (
    GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET,
    FRONTEND_URL,
)
import requests as httpx
from utils.cookies import set_refresh_cookie

@auth_bp.route("/login/github", methods=["GET"])
def github_login():
    """
    ---
    tags:
      - Authentication
    summary: Initiate GitHub OAuth login flow
    """
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    session.permanent = True

    redirect_uri = url_for("auth_bp.github_callback", _external=True)
    params = {
        "client_id":    GITHUB_APP_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope":        "read:user user:email",
        "state":        state,
    }
    auth_url = "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params)
    return redirect(auth_url)

@auth_bp.route("/callback/github", methods=["GET"])
def github_callback():
    state = request.args.get("state", "")
    if state != session.get("oauth_state"):
        return redirect(f"{FRONTEND_URL}/login?error=invalid_oauth_state")

    code = request.args.get("code", "")
    if not code:
        return redirect(f"{FRONTEND_URL}/login?error=code_missing")

    token_res = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={
            "client_id":     GITHUB_APP_CLIENT_ID,
            "client_secret": GITHUB_APP_CLIENT_SECRET,
            "code":          code,
            "redirect_uri":  url_for("auth_bp.github_callback", _external=True),
            "state":         state,
        },
        timeout=5,
    )
    token_res.raise_for_status()
    gh_token = token_res.json().get("access_token")

    user_res = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {gh_token}"},
    )
    user_res.raise_for_status()
    profile   = user_res.json()
    github_id = profile["id"]
    email     = profile.get("email")
    name      = profile.get("name") or profile["login"]
    avatar    = profile.get("avatar_url", "")

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, username, password_hash FROM users WHERE github_id = %s;", (github_id,))
        row = cur.fetchone()

        if row:
            user_id, username, pw_hash = row
            cur.execute("UPDATE users SET full_name = %s, picture_url = %s, email = %s WHERE id = %s;", (name, avatar, email, user_id))
        else:
            cur.execute("SELECT id, username, password_hash FROM users WHERE email = %s;", (email,))
            row2 = cur.fetchone()
            if row2:
                user_id, username, pw_hash = row2
                cur.execute("UPDATE users SET github_id = %s, full_name = %s, picture_url = %s WHERE id = %s;", (github_id, name, avatar, user_id))
            else:
                username = email.split("@")[0]
                cur.execute("INSERT INTO users (email, username, github_id, full_name, picture_url) VALUES (%s, %s, %s, %s, %s) RETURNING id;", (email, username, github_id, name, avatar))
                user_id = cur.fetchone()[0]
                pw_hash = None

        conn.commit()
        tokens = issue_tokens(
            cur,
            user_id=user_id,
            username=username,
            google_linked=False,
            github_linked=True,
            has_password=bool(pw_hash),
            display_name=name,
            avatar_url=avatar,
        )
    finally:
        pg_pool.putconn(conn)
        session.pop("oauth_state", None)

    qs = urllib.parse.urlencode({
        "access_token":  tokens["access_token"],
        "username":      username,
        "display_name":  name,
        "avatar_url":    avatar,
        "google_linked": "false",
        "github_linked": "true",
        "has_password":  str(bool(pw_hash)).lower(),
    })

    resp = make_response(redirect(f"{FRONTEND_URL}/auth/oauth-callback?{qs}"))
    set_refresh_cookie(resp, tokens["refresh_token"])
    return resp

@auth_bp.route("/link/github", methods=["POST"])
@jwt_required
def link_github():
    """
    ---
    tags:
      - Authentication
    summary: Initiate GitHub account linking flow
    """
    state = secrets.token_urlsafe(16)
    session["oauth_state"]  = state
    session["link_user_id"] = request.user["user_id"]
    session.permanent = True

    redirect_uri = url_for("auth_bp.github_link_callback", _external=True)
    params = {
        "client_id":    GITHUB_APP_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope":        "read:user user:email",
        "state":        state,
    }
    auth_url = "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params)
    return jsonify({"auth_url": auth_url}), 200

@auth_bp.route("/callback/link/github", methods=["GET"])
def github_link_callback():
    """
    ---
    tags:
      - Authentication
    summary: Complete GitHub account linking
    """
    if request.args.get("state") != session.get("oauth_state"):
        return jsonify({"message": "Invalid OAuth state"}), 400
    code = request.args.get("code", "")
    if not code:
        return jsonify({"message": "Code not provided"}), 400

    token_res = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={
            "client_id":     GITHUB_APP_CLIENT_ID,
            "client_secret": GITHUB_APP_CLIENT_SECRET,
            "code":          code,
            "redirect_uri":  url_for("auth_bp.github_link_callback", _external=True),
            "state":         session.get("oauth_state"),
        },
        timeout=5,
    )
    token_res.raise_for_status()
    access_token = token_res.json().get("access_token")

    user_res = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    user_res.raise_for_status()
    github_id = user_res.json()["id"]

    user_id = session.get("link_user_id")
    if not user_id:
        return jsonify({"message": "Session expired, please retry"}), 400

    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE github_id = %s;", (github_id,))
        if cur.fetchone():
            conn.rollback()
            return jsonify({"message": "GitHub already linked"}), 409

        cur.execute("UPDATE users SET github_id = %s WHERE id = %s;", (github_id, user_id))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"message": "Link failed", "error": str(exc)}), 500
    finally:
        pg_pool.putconn(conn)

    session.pop("oauth_state", None)
    session.pop("link_user_id", None)
    return redirect(f"{FRONTEND_URL}/")