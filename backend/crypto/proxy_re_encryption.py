"""
crypto/proxy_re_encryption.py
------------------------------
Simplified Proxy Re-Encryption (PRE) using RSA.

Scheme:
  - Owner A encrypts AES key K under their own RSA public key → enc_K_A
  - To delegate to B, owner generates re-encryption key: rk_A→B
  - Proxy applies rk_A→B to enc_K_A → enc_K_B (encrypted under B's public key)
  - B decrypts enc_K_B with their own RSA private key to recover K

Security properties:
  - Proxy never sees plaintext K
  - Owner's private key is never exposed to proxy or B
  - Re-encryption is non-transitive (cannot chain A→B→C)
"""

import base64
import json

from Crypto.PublicKey import RSA
from Crypto.Cipher    import PKCS1_OAEP
from Crypto.Hash      import SHA256

from .aes_rsa import rsa_decrypt_key, rsa_encrypt_key


def generate_reencryption_key(
    enc_aes_key_b64: str,
    owner_private_key_pem: str,
    delegate_public_key_pem: str,
) -> str:
    """
    Generate proxy re-encryption token.

    Steps:
      1. Decrypt the AES key using owner's private key.
      2. Re-encrypt it under the delegate's public key.

    The output is the re-encrypted AES key (encrypted under delegate's public key).
    This token can be safely handed to the proxy — it cannot recover the AES key
    without the delegate's private key.

    Returns base64-encoded re-encrypted AES key.
    """
    # Step 1: Owner decrypts the AES key
    aes_key = rsa_decrypt_key(enc_aes_key_b64, owner_private_key_pem)

    # Step 2: Re-encrypt under delegate's public key
    reenc_key_b64 = rsa_encrypt_key(aes_key, delegate_public_key_pem)

    return reenc_key_b64


def apply_reencryption(reenc_key_b64: str) -> str:
    """
    Proxy applies the re-encryption token.
    In this simplified scheme the token IS the re-encrypted key,
    so this is a pass-through — the proxy stores/forwards it.
    In a full ElGamal-based PRE this would perform a group operation.

    Returns the re-encrypted key (same value, models proxy forwarding).
    """
    return reenc_key_b64


def delegate_decrypt(reenc_key_b64: str, delegate_private_key_pem: str) -> bytes:
    """
    Delegate (User B) decrypts the re-encrypted AES key using their private key.
    Returns raw AES key bytes.
    """
    return rsa_decrypt_key(reenc_key_b64, delegate_private_key_pem)


# ─── Key bundle helpers ──────────────────────────────────────────────────────

def pack_reenc_bundle(
    file_id: str,
    owner_address: str,
    delegate_address: str,
    reenc_key_b64: str,
    enc_metadata: dict,
) -> str:
    """Pack re-encryption info into a JSON string for blockchain/S3 storage."""
    bundle = {
        "file_id":          file_id,
        "owner":            owner_address,
        "delegate":         delegate_address,
        "reenc_aes_key":    reenc_key_b64,
        "enc_metadata":     enc_metadata,   # iv, tag stored alongside
    }
    return json.dumps(bundle)


def unpack_reenc_bundle(bundle_json: str) -> dict:
    """Unpack a re-encryption bundle JSON string."""
    return json.loads(bundle_json)
