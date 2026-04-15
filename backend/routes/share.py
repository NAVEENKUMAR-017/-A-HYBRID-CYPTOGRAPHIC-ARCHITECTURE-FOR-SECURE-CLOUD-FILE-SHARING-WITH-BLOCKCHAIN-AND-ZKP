"""
routes/share.py
----------------
Endpoints:
  POST /api/share/delegate        - delegate file access via PRE
  POST /api/share/revoke          - revoke delegate access
  GET  /api/share/<file_id>/bundle - fetch re-encryption bundle for delegate
"""

from flask import Blueprint, g, jsonify, request

from auth import require_auth
from blockchain import BlockchainAudit
from crypto import sha256_hash
from crypto.proxy_re_encryption import generate_reencryption_key, pack_reenc_bundle
from storage import (
    download_encrypted_file,
    download_reenc_bundle,
    file_exists,
    upload_reenc_bundle,
)

share_bp = Blueprint("share", __name__, url_prefix="/api/share")
_chain = BlockchainAudit()


@share_bp.route("/delegate", methods=["POST"])
@require_auth
def delegate_access():
    """
    Grant a receiver access to a file via proxy re-encryption.
    """
    data = request.get_json(silent=True) or {}
    required = [
        "file_id",
        "owner_private_key",
        "delegate_public_key",
        "delegate_id",
        "delegate_eth_address",
        "eth_private_key",
    ]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    file_id = data["file_id"]
    owner_priv_pem = data["owner_private_key"]
    delegate_pub_pem = data["delegate_public_key"]
    delegate_id = data["delegate_id"]
    delegate_eth_addr = data["delegate_eth_address"]
    eth_priv_key = data["eth_private_key"]

    if not file_exists(file_id):
        return jsonify({"error": "File not found"}), 404

    _, metadata = download_encrypted_file(file_id)
    enc_aes_key_b64 = metadata["enc_aes_key"]

    try:
        reenc_key_b64 = generate_reencryption_key(
            enc_aes_key_b64,
            owner_priv_pem,
            delegate_pub_pem,
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to generate re-encryption key: {exc}"}), 400

    bundle_json = pack_reenc_bundle(
        file_id=file_id,
        owner_address=g.user_id,
        delegate_address=delegate_id,
        reenc_key_b64=reenc_key_b64,
        enc_metadata={"iv": metadata["iv"], "tag": metadata["tag"]},
    )
    upload_reenc_bundle(file_id, delegate_id, bundle_json)

    ciphertext_b64, _ = download_encrypted_file(file_id)
    file_hash_hex = sha256_hash(ciphertext_b64.encode())
    try:
        tx = _chain.record_share(file_hash_hex, file_id, delegate_eth_addr, eth_priv_key)
    except Exception as exc:
        return jsonify({"error": f"Blockchain receiver-share record failed: {exc}"}), 503

    return jsonify(
        {
            "status": "shared",
            "file_id": file_id,
            "delegate_id": delegate_id,
            "receiver_id": delegate_id,
            "tx_hash": tx["tx_hash"],
            "block": tx["block_number"],
        }
    )


@share_bp.route("/revoke", methods=["POST"])
@require_auth
def revoke_access():
    data = request.get_json(silent=True) or {}
    required = ["file_id", "delegate_id", "delegate_eth_address", "eth_private_key"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    file_id = data["file_id"]
    delegate_eth_addr = data["delegate_eth_address"]
    eth_priv_key = data["eth_private_key"]

    ciphertext_b64, _ = download_encrypted_file(file_id)
    file_hash_hex = sha256_hash(ciphertext_b64.encode())
    try:
        tx = _chain.revoke_access(file_hash_hex, file_id, delegate_eth_addr, eth_priv_key)
    except Exception as exc:
        return jsonify({"error": f"Blockchain revoke failed: {exc}"}), 503

    return jsonify({"status": "revoked", "file_id": file_id, "tx_hash": tx["tx_hash"]})


@share_bp.route("/<file_id>/bundle", methods=["GET"])
@require_auth
def get_bundle(file_id: str):
    try:
        bundle = download_reenc_bundle(file_id, g.user_id)
    except Exception:
        return jsonify({"error": "No re-encryption bundle found for this user"}), 404

    return jsonify({"bundle": bundle})
