"""
routes/files.py
----------------
Endpoints:
  POST   /api/files/upload          - encrypt & upload file
  GET    /api/files/<file_id>        - download & decrypt file
  GET    /api/files/                 - list user's owned and shared files
  DELETE /api/files/<file_id>        - delete file
"""

import base64
import uuid

from flask import Blueprint, g, jsonify, request

from auth import require_auth
from blockchain import BlockchainAudit
from crypto import (
    aes_gcm_decrypt,
    aes_gcm_encrypt,
    delegate_decrypt,
    generate_aes_key,
    rsa_decrypt_key,
    rsa_encrypt_key,
    sha256_hash,
)
from storage import (
    delete_file,
    download_encrypted_file,
    download_reenc_bundle,
    file_exists,
    list_shared_files,
    list_user_files,
    upload_encrypted_file,
)

files_bp = Blueprint("files", __name__, url_prefix="/api/files")
_chain = BlockchainAudit()


@files_bp.route("/upload", methods=["POST"])
@require_auth
def upload_file():
    """
    Expects multipart/form-data:
      - file: binary file data
      - public_key: owner's RSA public key PEM
      - eth_address: owner's Ethereum wallet address
      - eth_private_key: owner's Ethereum private key (for signing tx)
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file_obj = request.files["file"]
    public_key_pem = request.form.get("public_key", "")
    eth_address = request.form.get("eth_address", "")
    eth_priv_key = request.form.get("eth_private_key", "")

    if not all([public_key_pem, eth_address, eth_priv_key]):
        return jsonify({"error": "Missing required fields"}), 400

    plaintext = file_obj.read()
    file_name = file_obj.filename
    file_id = str(uuid.uuid4())

    aes_key = generate_aes_key()
    enc_result = aes_gcm_encrypt(plaintext, aes_key)
    enc_aes_key_b64 = rsa_encrypt_key(aes_key, public_key_pem)
    file_hash_hex = sha256_hash(plaintext)

    upload_encrypted_file(
        file_id=file_id,
        ciphertext_b64=enc_result["ciphertext"],
        enc_aes_key_b64=enc_aes_key_b64,
        iv_b64=enc_result["iv"],
        tag_b64=enc_result["tag"],
        file_name=file_name,
        owner_id=g.user_id,
    )

    try:
        tx = _chain.record_upload(file_hash_hex, file_id, eth_priv_key)
    except Exception as exc:
        return jsonify({"error": f"Blockchain upload record failed: {exc}"}), 503

    return (
        jsonify(
            {
                "file_id": file_id,
                "file_name": file_name,
                "file_hash": file_hash_hex,
                "tx_hash": tx["tx_hash"],
                "block": tx["block_number"],
                "status": "uploaded",
            }
        ),
        201,
    )


@files_bp.route("/<file_id>/download", methods=["POST"])
@require_auth
def download_file(file_id: str):
    """
    Expects JSON body:
      - private_key: requester's RSA private key PEM
      - eth_address: requester's Ethereum wallet address
      - eth_private_key: for signing access tx
      - zkp_proof: JSON-serialized ZKP proof dict
    """
    data = request.get_json(silent=True) or {}
    priv_key_pem = data.get("private_key", "")
    eth_address = data.get("eth_address", "")
    eth_priv_key = data.get("eth_private_key", "")
    zkp_proof = data.get("zkp_proof", {})

    if not all([priv_key_pem, eth_address, eth_priv_key]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        has_access = _chain.has_access(file_id, eth_address)
    except Exception as exc:
        return jsonify({"error": f"Blockchain access check failed: {exc}"}), 503

    if not has_access:
        return jsonify({"error": "Access denied"}), 403

    from crypto.zkp import proof_hash, verify_proof

    if not verify_proof(zkp_proof):
        return jsonify({"error": "ZKP verification failed"}), 403

    if not file_exists(file_id):
        return jsonify({"error": "File not found"}), 404

    ciphertext_b64, metadata = download_encrypted_file(file_id)

    try:
        if metadata.get("owner_id") == g.user_id:
            aes_key = rsa_decrypt_key(metadata["enc_aes_key"], priv_key_pem)
        else:
            bundle = download_reenc_bundle(file_id, g.user_id)
            aes_key = delegate_decrypt(bundle["reenc_aes_key"], priv_key_pem)
    except Exception:
        return jsonify({"error": "Failed to decrypt AES key"}), 400

    try:
        plaintext = aes_gcm_decrypt(
            {"ciphertext": ciphertext_b64, "iv": metadata["iv"], "tag": metadata["tag"]},
            aes_key,
        )
    except ValueError:
        return jsonify({"error": "File integrity check failed"}), 400

    p_hash = proof_hash(zkp_proof)
    file_hash_hex = sha256_hash(plaintext)
    try:
        _chain.record_access(file_hash_hex, file_id, p_hash, eth_priv_key)
    except Exception as exc:
        return jsonify({"error": f"Blockchain access record failed: {exc}"}), 503

    return jsonify(
        {
            "file_id": file_id,
            "file_name": metadata["file_name"],
            "content_b64": base64.b64encode(plaintext).decode(),
            "status": "decrypted",
        }
    )


@files_bp.route("/", methods=["GET"])
@require_auth
def list_files():
    owned_files = list_user_files(g.user_id)
    shared_files = list_shared_files(g.user_id)
    return jsonify({"files": owned_files, "shared_files": shared_files})


@files_bp.route("/<file_id>", methods=["DELETE"])
@require_auth
def remove_file(file_id: str):
    if not file_exists(file_id):
        return jsonify({"error": "File not found"}), 404
    delete_file(file_id)
    return jsonify({"status": "deleted", "file_id": file_id})
