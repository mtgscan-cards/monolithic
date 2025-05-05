# routes/auth/utils.py

from typing import Optional, List
import hashlib
import secrets

from google.oauth2 import id_token
from google.auth.transport import requests as grequests
import requests as httpx

from config import HCAPTCHA_SECRET, GOOGLE_CLIENT_ID

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def verify_hcaptcha(token: str, remote_ip: str) -> bool:
    try:
        res = httpx.post(
            "https://hcaptcha.com/siteverify",
            data={"secret": HCAPTCHA_SECRET, "response": token, "remoteip": remote_ip},
            timeout=5,
        ).json()
        return res.get("success", False)
    except Exception as exc:
        print("hCaptcha error", exc)
        return False


def verify_google_token(cred: str) -> dict:
    return id_token.verify_oauth2_token(
        cred, grequests.Request(), GOOGLE_CLIENT_ID
    )


def _hash_code(code: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.sha256(f"{salt}{code}".encode()).hexdigest()
    return f"{salt}${digest}"


def _generate_codes(n: int = 10) -> List[str]:
    codes: List[str] = []
    for _ in range(n):
        part1 = "".join(secrets.choice(ALPHABET) for _ in range(5))
        part2 = "".join(secrets.choice(ALPHABET) for _ in range(5))
        codes.append(f"{part1}-{part2}")
    return codes


def _check_code(code: str, hashed: str) -> bool:
    salt, _ = hashed.split("$", 1)
    return _hash_code(code, salt) == hashed