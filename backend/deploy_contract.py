"""
deploy_contract.py
Compiles and deploys SecureFileAudit.sol to Ganache.
Writes CONTRACT_ADDRESS back to .env and ABI to contracts/.
Run once before starting Flask: python deploy_contract.py
"""

import os
import json
from pathlib import Path

from solcx import compile_source, install_solc
from web3 import Web3
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware  # ✅ FIXED
from eth_account import Account
from dotenv import load_dotenv, set_key

# Load environment variables
load_dotenv()

RPC_URL      = os.getenv("GANACHE_RPC_URL", "HTTP://127.0.0.1:7545")
DEPLOYER_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV_FILE = BASE_DIR / ".env"
BACKEND_ENV_FILE = BASE_DIR / "backend" / ".env"
SOL_FILE = BASE_DIR / "contracts" / "SecureFileAudit.sol"
ABI_OUT  = BASE_DIR / "contracts" / "SecureFileAudit_abi.json"


def main():
    print("🔧 Installing Solidity compiler (0.8.19)...")
    install_solc("0.8.19")

    print("🔗 Connecting to Ganache...")
    w3 = Web3(Web3.HTTPProvider(RPC_URL))

    # ✅ FIXED middleware
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        raise Exception(f"❌ Cannot connect to {RPC_URL}")

    print(f"✅ Connected | Chain ID: {w3.eth.chain_id}")

    # Select deployer account
    if DEPLOYER_KEY:
        account = Account.from_key(DEPLOYER_KEY)
        deployer_address = account.address
        print(f"🔑 Using private key account: {deployer_address}")
    else:
        deployer_address = w3.eth.accounts[0]
        account = None
        print(f"👤 Using Ganache default account: {deployer_address}")

    # Read contract
    print("📄 Reading contract file...")
    source_code = SOL_FILE.read_text()

    print("⚙️ Compiling contract...")
    compiled = compile_source(
        source_code,
        output_values=["abi", "bin"],
        solc_version="0.8.19",
    )

    contract_id = "<stdin>:SecureFileAudit"
    abi = compiled[contract_id]["abi"]
    bytecode = compiled[contract_id]["bin"]

    # Save ABI
    ABI_OUT.write_text(json.dumps(abi, indent=2))
    print(f"✅ ABI saved at: {ABI_OUT}")

    # Deploy contract
    print("🚀 Deploying contract...")
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    if account:  # Using private key
        nonce = w3.eth.get_transaction_count(deployer_address)

        tx = Contract.constructor().build_transaction({
            "from": deployer_address,
            "nonce": nonce,
            "gas": 3000000,
            "gasPrice": w3.to_wei("1", "gwei"),
        })

        signed_tx = w3.eth.account.sign_transaction(tx, DEPLOYER_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    else:  # Using Ganache account
        tx_hash = Contract.constructor().transact({
            "from": deployer_address,
            "gas": 3000000
        })

    print("⏳ Waiting for transaction receipt...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    contract_address = receipt["contractAddress"]

    print("\n🎉 CONTRACT DEPLOYED SUCCESSFULLY!")
    print(f"📍 Address: {contract_address}")
    print(f"📦 Block: {receipt['blockNumber']}")
    print(f"⛽ Gas Used: {receipt['gasUsed']}")

    # Save to .env
    set_key(str(ROOT_ENV_FILE), "CONTRACT_ADDRESS", contract_address)
    set_key(str(BACKEND_ENV_FILE), "CONTRACT_ADDRESS", contract_address)
    print("\n✅ CONTRACT_ADDRESS saved to root and backend .env files")

    if not DEPLOYER_KEY:
        print("\n⚠️ NOTE:")
        print("Set DEPLOYER_PRIVATE_KEY in .env for production use.")
        print(f"Default Ganache Account: {w3.eth.accounts[0]}")

    print("\n✅ Deployment completed successfully!")


if __name__ == "__main__":
    main()
