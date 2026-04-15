"""
crypto/zkp.py
-------------
Zero-Knowledge Proof using the Schnorr identification protocol
over a 2048-bit prime group (discrete logarithm hardness).

Protocol (non-interactive via Fiat-Shamir transform):
  Setup:
    - Public prime p, generator g
    - Secret: x (user's private scalar derived from RSA key hash)
    - Public commitment: Y = g^x mod p

  Prove (prover knows x):
    1. Pick random r
    2. Compute commitment T = g^r mod p
    3. Compute challenge c = H(g || Y || T)   [Fiat-Shamir]
    4. Compute response s = r + c*x            (in integers, bounded)
    5. Proof π = (T, s)

  Verify:
    - Recompute c = H(g || Y || T)
    - Check g^s ≡ T * Y^c (mod p)

Properties:
  - Completeness: honest prover always passes
  - Soundness: false proof rejected with high probability
  - Zero-Knowledge: verifier learns nothing about x
"""

import hashlib
import os
import json
import base64


# ─── Group parameters (RFC 3526 Group 14, 2048-bit MODP) ────────────────────
P = int(
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D"
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9"
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
    "15728E5A8AACAA68FFFFFFFFFFFFFFFF",
    16,
)
G = 2  # generator
Q = (P - 1) // 2  # Sophie Germain prime (order of subgroup)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _h(*values: int) -> int:
    """Hash multiple integers → integer challenge."""
    raw = b"||".join(str(v).encode() for v in values)
    return int(hashlib.sha256(raw).hexdigest(), 16)


def derive_secret(private_key_pem: str, user_id: str) -> int:
    """
    Derive a ZKP secret scalar from the user's RSA private key + user_id.
    The scalar x is in [1, Q-1].
    """
    seed = hashlib.sha256(
        (private_key_pem + user_id).encode()
    ).digest()
    x = int.from_bytes(seed, "big") % (Q - 1) + 1  # ensure x ∈ [1, Q-1]
    return x


def compute_public_commitment(x: int) -> int:
    """Compute Y = g^x mod p (public key in ZKP scheme)."""
    return pow(G, x, P)


# ─── Core Protocol ───────────────────────────────────────────────────────────

def generate_proof(private_key_pem: str, user_id: str) -> dict:
    """
    Generate a Schnorr ZKP proof that the prover knows x
    (i.e., knows the private key associated with user_id).

    Returns proof dict: { Y, T, s, user_id }
    """
    x = derive_secret(private_key_pem, user_id)
    Y = compute_public_commitment(x)

    # Step 1: random nonce r ∈ [1, Q-1]
    r = int.from_bytes(os.urandom(32), "big") % (Q - 1) + 1

    # Step 2: commitment T = g^r mod p
    T = pow(G, r, P)

    # Step 3: challenge c = H(g, Y, T)
    c = _h(G, Y, T)

    # Step 4: response s = r + c*x  (unbounded integer; verified via modular exp)
    s = r + c * x

    return {
        "user_id": user_id,
        "Y": Y,
        "T": T,
        "s": s,
    }


def verify_proof(proof: dict) -> bool:
    """
    Verify a Schnorr ZKP proof.
    Returns True if valid, False otherwise.

    The verifier only needs: Y (public commitment), T, s.
    No private data is revealed.
    """
    try:
        Y = int(proof["Y"])
        T = int(proof["T"])
        s = int(proof["s"])

        # Recompute challenge
        c = _h(G, Y, T)

        # Check: g^s ≡ T * Y^c (mod p)
        lhs = pow(G, s, P)
        rhs = (T * pow(Y, c, P)) % P

        return lhs == rhs
    except Exception:
        return False


def proof_to_json(proof: dict) -> str:
    """Serialize proof to JSON string (Y, T, s are large ints → strings)."""
    return json.dumps({
        "user_id": proof["user_id"],
        "Y": str(proof["Y"]),
        "T": str(proof["T"]),
        "s": str(proof["s"]),
    })


def proof_from_json(proof_json: str) -> dict:
    """Deserialize proof from JSON string."""
    raw = json.loads(proof_json)
    return {
        "user_id": raw["user_id"],
        "Y": int(raw["Y"]),
        "T": int(raw["T"]),
        "s": int(raw["s"]),
    }


def proof_hash(proof: dict) -> bytes:
    """Return 32-byte SHA-256 hash of proof (for on-chain storage as bytes32)."""
    serialized = proof_to_json(proof).encode()
    return hashlib.sha256(serialized).digest()
