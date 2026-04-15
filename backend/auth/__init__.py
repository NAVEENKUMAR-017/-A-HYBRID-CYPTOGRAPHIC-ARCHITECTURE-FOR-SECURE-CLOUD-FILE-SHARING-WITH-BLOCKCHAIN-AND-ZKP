"""
auth/cognito.py
----------------
Verify AWS Cognito JWT tokens in Flask routes.
Uses python-jose to decode and validate the token signature
against Cognito's JWKS endpoint.
"""

import os
import json
import requests
from functools import wraps

from flask import request, jsonify, g
from jose  import jwt, JWTError

from dotenv import load_dotenv
load_dotenv()

REGION       = os.getenv("COGNITO_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
APP_CLIENT_ID= os.getenv("COGNITO_APP_CLIENT_ID", "")

JWKS_URL = (
    f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
    f"/.well-known/jwks.json"
)

_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        resp = requests.get(JWKS_URL, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _get_public_key(token: str):
    """Extract the matching public key from JWKS for the given token."""
    headers = jwt.get_unverified_header(token)
    kid     = headers.get("kid")
    jwks    = _get_jwks()
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return key
    raise JWTError("No matching key found in JWKS")


def verify_cognito_token(token: str) -> dict:
    """
    Verify a Cognito JWT (access token or ID token).
    Returns decoded claims dict on success.
    Raises JWTError on failure.
    """
    public_key = _get_public_key(token)
    claims = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=APP_CLIENT_ID,
        options={"verify_exp": True},
    )
    return claims


# ─── Flask decorator ─────────────────────────────────────────────────────────

def require_auth(f):
    """
    Flask route decorator that validates the Cognito JWT in the
    Authorization: Bearer <token> header.
    Sets g.user_id and g.user_claims on success.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header[len("Bearer "):]
        try:
            claims = verify_cognito_token(token)
        except JWTError as e:
            return jsonify({"error": f"Token invalid: {str(e)}"}), 401

        g.user_id     = claims.get("sub")        # Cognito user UUID
        g.user_email  = claims.get("email", "")
        g.user_claims = claims
        return f(*args, **kwargs)
    return decorated
