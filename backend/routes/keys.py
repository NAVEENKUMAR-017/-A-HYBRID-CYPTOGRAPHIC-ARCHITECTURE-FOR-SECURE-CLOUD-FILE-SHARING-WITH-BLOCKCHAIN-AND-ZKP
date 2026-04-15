"""
routes/keys.py
--------------
Endpoints:
  POST  /api/keys/generate    — generate RSA key pair for user
  POST  /api/keys/zkp/prove   — generate a ZKP proof
  POST  /api/keys/zkp/verify  — verify a ZKP proof
"""

from flask import Blueprint, request, jsonify, g

from auth   import require_auth
from crypto import generate_rsa_keypair
from crypto.zkp import (
    generate_proof, verify_proof,
    proof_to_json, proof_from_json,
)

keys_bp = Blueprint("keys", __name__, url_prefix="/api/keys")


@keys_bp.route("/generate", methods=["POST"])
@require_auth
def generate_keys():
    """
    Generate a fresh RSA-2048 key pair for the authenticated user.
    IMPORTANT: The private key is returned ONCE — store it securely client-side.
    Never stored on the server.
    """
    private_pem, public_pem = generate_rsa_keypair()
    return jsonify({
        "user_id":    g.user_id,
        "public_key": public_pem,
        "private_key": private_pem,  # ← store this securely; server won't keep it
        "warning": "Store your private key securely. It cannot be recovered.",
    })


@keys_bp.route("/zkp/prove", methods=["POST"])
@require_auth
def zkp_prove():
    """
    Generate a Schnorr ZKP proof for the authenticated user.

    Expects JSON:
      - private_key : user's RSA private key PEM
    Returns the serialized proof.
    """
    data = request.get_json()
    priv_key_pem = data.get("private_key", "")
    if not priv_key_pem:
        return jsonify({"error": "private_key required"}), 400

    proof      = generate_proof(priv_key_pem, g.user_id)
    proof_json = proof_to_json(proof)

    return jsonify({
        "user_id": g.user_id,
        "proof":   proof_json,
        "valid_for": "single session — generate fresh proof per request",
    })


@keys_bp.route("/zkp/verify", methods=["POST"])
def zkp_verify():
    """
    Verify a ZKP proof (public endpoint — no auth required, proof is self-contained).

    Expects JSON:
      - proof : JSON-serialized proof string (from /zkp/prove)
    Returns verification result.
    """
    data       = request.get_json()
    proof_json = data.get("proof", "")
    if not proof_json:
        return jsonify({"error": "proof required"}), 400

    try:
        proof  = proof_from_json(proof_json)
        result = verify_proof(proof)
    except Exception as e:
        return jsonify({"error": f"Proof parse error: {str(e)}", "valid": False}), 400

    return jsonify({
        "valid":   result,
        "user_id": proof.get("user_id"),
    })
