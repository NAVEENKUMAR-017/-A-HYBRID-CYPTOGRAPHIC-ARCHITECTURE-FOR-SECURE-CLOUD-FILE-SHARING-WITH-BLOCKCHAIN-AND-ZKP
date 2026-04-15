"""
blockchain/audit.py
--------------------
Web3 interface to the SecureFileAudit smart contract on Ganache.
"""

import os
import json
from pathlib import Path

from web3 import Web3
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────
RPC_URL          = os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "")
DEPLOYER_KEY     = os.getenv("DEPLOYER_PRIVATE_KEY", "0x1f39ea068ef7976795cedc3ef11d394167df172382a3183b05b78cbc74c3ecca")

# Load ABI from compiled artifact
ABI_PATH = Path(__file__).parent.parent.parent / "contracts" / "SecureFileAudit_abi.json"


def _load_abi() -> list:
    if ABI_PATH.exists():
        with open(ABI_PATH) as f:
            return json.load(f)
    return []


def _hex_to_bytes(hex_value: str) -> bytes:
    normalized = hex_value[2:] if hex_value.startswith("0x") else hex_value
    if len(normalized) % 2 != 0:
        normalized = f"0{normalized}"
    return bytes.fromhex(normalized)


class BlockchainAudit:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        # PoA middleware for Ganache
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self.w3.is_connected():
            raise ConnectionError(f"Cannot connect to Ganache at {RPC_URL}")

        self.abi = _load_abi()
        self.contract_address = None
        if CONTRACT_ADDRESS and self.abi:
            self.contract_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
            self.contract = self.w3.eth.contract(
                address=self.contract_address,
                abi=self.abi,
            )
        else:
            self.contract = None

    def _require_contract(self):
        if self.contract is None or self.contract_address is None:
            raise RuntimeError("Blockchain contract is not configured")
        code = self.w3.eth.get_code(self.contract_address)
        if not code or code == b"":
            raise RuntimeError(
                f"No contract code found at configured address {self.contract_address}. "
                "Redeploy the contract and update backend/.env."
            )
        return self.contract

    # ─── Internal tx helper ──────────────────────────────────────────────────

    def _send_tx(self, fn, private_key: str) -> dict:
        """Build, sign, send a transaction; return receipt dict."""
        account = Account.from_key(private_key)
        nonce   = self.w3.eth.get_transaction_count(account.address)
        tx      = fn.build_transaction({
            "from":     account.address,
            "nonce":    nonce,
            "gas":      500_000,
            "gasPrice": self.w3.to_wei("1", "gwei"),
        })
        signed  = self.w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash":      tx_hash.hex(),
            "block_number": receipt["blockNumber"],
            "gas_used":     receipt["gasUsed"],
            "status":       receipt["status"],  # 1 = success
        }

    # ─── Write calls ─────────────────────────────────────────────────────────

    def record_upload(self, file_hash_hex: str, file_id: str, private_key: str) -> dict:
        file_hash_bytes = _hex_to_bytes(file_hash_hex)
        fn = self._require_contract().functions.recordUpload(file_hash_bytes, file_id)
        return self._send_tx(fn, private_key)

    def record_share(
        self, file_hash_hex: str, file_id: str,
        delegate_address: str, private_key: str
    ) -> dict:
        file_hash_bytes    = _hex_to_bytes(file_hash_hex)
        delegate_checksum  = Web3.to_checksum_address(delegate_address)
        fn = self._require_contract().functions.recordShare(file_hash_bytes, file_id, delegate_checksum)
        return self._send_tx(fn, private_key)

    def record_access(
        self, file_hash_hex: str, file_id: str,
        zkp_proof_hash: bytes, private_key: str
    ) -> dict:
        file_hash_bytes = _hex_to_bytes(file_hash_hex)
        fn = self._require_contract().functions.recordAccess(file_hash_bytes, file_id, zkp_proof_hash)
        return self._send_tx(fn, private_key)

    def revoke_access(
        self, file_hash_hex: str, file_id: str,
        delegate_address: str, private_key: str
    ) -> dict:
        file_hash_bytes   = _hex_to_bytes(file_hash_hex)
        delegate_checksum = Web3.to_checksum_address(delegate_address)
        fn = self._require_contract().functions.revokeAccess(file_hash_bytes, file_id, delegate_checksum)
        return self._send_tx(fn, private_key)

    # ─── Read calls ──────────────────────────────────────────────────────────

    def get_record(self, record_id: int) -> dict:
        rec = self._require_contract().functions.getRecord(record_id).call()
        return {
            "id":            rec[0],
            "event_type":    ["UPLOAD", "SHARE", "ACCESS", "REVOKE", "ZKP_VERIFY"][rec[1]],
            "actor":         rec[2],
            "file_hash":     rec[3].hex(),
            "file_id":       rec[4],
            "delegate":      rec[5],
            "zkp_proof_hash":rec[6].hex(),
            "timestamp":     rec[7],
            "valid":         rec[8],
        }

    def get_file_audit_trail(self, file_id: str) -> list[dict]:
        record_ids = self._require_contract().functions.getFileRecords(file_id).call()
        return [self.get_record(rid) for rid in record_ids]

    def get_user_audit_trail(self, address: str) -> list[dict]:
        checksum   = Web3.to_checksum_address(address)
        record_ids = self._require_contract().functions.getUserRecords(checksum).call()
        return [self.get_record(rid) for rid in record_ids]

    def has_access(self, file_id: str, address: str) -> bool:
        checksum = Web3.to_checksum_address(address)
        return self._require_contract().functions.hasAccess(file_id, checksum).call()

    def get_file_owner(self, file_id: str) -> str:
        return self._require_contract().functions.getFileOwner(file_id).call()

    def total_records(self) -> int:
        return self._require_contract().functions.totalRecords().call()

    # ─── Utility ─────────────────────────────────────────────────────────────

    def is_connected(self) -> bool:
        return self.w3.is_connected()

    def get_accounts(self) -> list[str]:
        return self.w3.eth.accounts
