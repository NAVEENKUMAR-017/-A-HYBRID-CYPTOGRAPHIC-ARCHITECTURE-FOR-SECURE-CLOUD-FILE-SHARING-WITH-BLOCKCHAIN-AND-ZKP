"""
routes/audit.py
----------------
Endpoints:
  GET /api/audit/file/<file_id>     — full audit trail for a file
  GET /api/audit/user/<eth_address> — audit trail for a user
  GET /api/audit/record/<id>        — single audit record
  GET /api/audit/stats              — overall blockchain stats
"""

from flask import Blueprint, jsonify, g

from auth       import require_auth
from blockchain import BlockchainAudit

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")
_chain   = BlockchainAudit()


@audit_bp.route("/file/<file_id>", methods=["GET"])
@require_auth
def file_audit(file_id: str):
    records = _chain.get_file_audit_trail(file_id)
    return jsonify({"file_id": file_id, "records": records, "count": len(records)})


@audit_bp.route("/user/<eth_address>", methods=["GET"])
@require_auth
def user_audit(eth_address: str):
    records = _chain.get_user_audit_trail(eth_address)
    return jsonify({"address": eth_address, "records": records, "count": len(records)})


@audit_bp.route("/record/<int:record_id>", methods=["GET"])
@require_auth
def single_record(record_id: int):
    try:
        record = _chain.get_record(record_id)
        return jsonify(record)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@audit_bp.route("/stats", methods=["GET"])
@require_auth
def stats():
    return jsonify({
        "total_records":  _chain.total_records(),
        "chain_connected": _chain.is_connected(),
        "accounts":       _chain.get_accounts(),
    })
