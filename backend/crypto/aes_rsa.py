"""
crypto/aes_rsa.py
-----------------
Handles:
  - AES-256-GCM symmetric encryption / decryption
  - RSA-2048 key pair generation
  - RSA OAEP encryption / decryption of AES keys
  - SHA-256 file hashing
"""

import os
import hashlib
import base64
import json

from Crypto.Cipher    import AES, PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Hash      import SHA256
from Crypto.Signature import pss


# ─── AES-GCM ─────────────────────────────────────────────────────────────────

def generate_aes_key() -> bytes:
    """Generate a random 256-bit AES key."""
    return os.urandom(32)


def aes_gcm_encrypt(plaintext: bytes, key: bytes) -> dict:
    """
    Encrypt plaintext with AES-256-GCM.
    Returns dict with base64-encoded: ciphertext, tag, iv.
    """
    iv = os.urandom(16)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "tag":        base64.b64encode(tag).decode(),
        "iv":         base64.b64encode(iv).decode(),
    }


def aes_gcm_decrypt(enc_data: dict, key: bytes) -> bytes:
    """
    Decrypt AES-256-GCM ciphertext.
    Raises ValueError on tag mismatch (tamper detected).
    """
    ciphertext = base64.b64decode(enc_data["ciphertext"])
    tag        = base64.b64decode(enc_data["tag"])
    iv         = base64.b64decode(enc_data["iv"])

    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    return plaintext


# ─── RSA-2048 ────────────────────────────────────────────────────────────────

def generate_rsa_keypair() -> tuple[str, str]:
    """
    Generate RSA-2048 key pair.
    Returns (private_key_pem, public_key_pem) as strings.
    """
    key = RSA.generate(2048)
    private_pem = key.export_key().decode()
    public_pem  = key.publickey().export_key().decode()
    return private_pem, public_pem


def rsa_encrypt_key(aes_key: bytes, public_key_pem: str) -> str:
    """Encrypt AES key with RSA public key (OAEP+SHA256). Returns base64 string."""
    pub_key = RSA.import_key(public_key_pem)
    cipher  = PKCS1_OAEP.new(pub_key, hashAlgo=SHA256)
    enc_key = cipher.encrypt(aes_key)
    return base64.b64encode(enc_key).decode()


def rsa_decrypt_key(enc_key_b64: str, private_key_pem: str) -> bytes:
    """Decrypt AES key with RSA private key. Returns raw AES key bytes."""
    enc_key  = base64.b64decode(enc_key_b64)
    priv_key = RSA.import_key(private_key_pem)
    cipher   = PKCS1_OAEP.new(priv_key, hashAlgo=SHA256)
    return cipher.decrypt(enc_key)


# ─── RSA Digital Signature ───────────────────────────────────────────────────

def rsa_sign(message: bytes, private_key_pem: str) -> str:
    """Sign a message with RSA-PSS. Returns base64 signature."""
    priv_key  = RSA.import_key(private_key_pem)
    h         = SHA256.new(message)
    signature = pss.new(priv_key).sign(h)
    return base64.b64encode(signature).decode()


def rsa_verify(message: bytes, signature_b64: str, public_key_pem: str) -> bool:
    """Verify RSA-PSS signature. Returns True if valid."""
    try:
        pub_key   = RSA.import_key(public_key_pem)
        signature = base64.b64decode(signature_b64)
        h         = SHA256.new(message)
        pss.new(pub_key).verify(h, signature)
        return True
    except (ValueError, TypeError):
        return False


# ─── File Hashing ────────────────────────────────────────────────────────────

def sha256_hash(data: bytes) -> str:
    """Return hex SHA-256 hash of data."""
    return hashlib.sha256(data).hexdigest()


def sha256_hash_bytes32(data: bytes) -> bytes:
    """Return raw 32-byte SHA-256 hash (for Solidity bytes32)."""
    return hashlib.sha256(data).digest()
