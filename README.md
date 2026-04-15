# Secure Cloud File Sharing
## AES-GCM + Proxy Re-Encryption + Blockchain Audit + ZKP + AWS

### Stack
- **Frontend**: React (Vite)
- **Backend**: Python Flask
- **Cloud Storage**: AWS S3
- **Authentication**: AWS Cognito
- **Blockchain**: Ganache (local Ethereum PoA)
- **Crypto Libraries**: PyCryptodome, py_ecc, web3.py
- **ZKP**: zk-SNARK (simplified Schnorr proof)

---

## Project Structure
```
secure-file-share/
├── frontend/          # React UI
│   └── src/
│       ├── components/
│       ├── pages/
│       └── utils/
├── backend/           # Flask API
│   ├── routes/
│   ├── crypto/
│   └── blockchain/
├── contracts/         # Solidity smart contracts
├── scripts/           # Deploy & setup scripts
├── .env.example
└── README.md
```

---

## Setup Instructions

### 1. Prerequisites
```bash
node >= 18, python >= 3.10, ganache-cli, npm
```

### 2. Install Ganache
```bash
npm install -g ganache
ganache --port 8545 --deterministic
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env        # Fill in your AWS credentials
python deploy_contract.py      # Deploy smart contract to Ganache
flask run --port 5000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
cp ../.env.example .env.local  # Fill in Cognito + API URL
npm run dev
```

---

## AWS Configuration

### S3 Bucket
1. Create bucket: `secure-file-share-bucket`
2. Block all public access: **ON**
3. Enable server-side encryption (SSE-S3)

### Cognito User Pool
1. Create User Pool with email sign-in
2. Create App Client (no secret for SPA)
3. Set callback URL: `http://localhost:5173`
4. Note: Pool ID and Client ID → paste into `.env`

---

## Environment Variables
See `.env.example` for all required variables.

---

## Security Model
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Confidentiality | AES-256-GCM | File encryption |
| Key Exchange | RSA-2048 | Encrypt AES key |
| Access Delegation | Proxy Re-Encryption | Share without re-encrypting |
| Audit Trail | Ethereum Blockchain | Immutable logs |
| Identity Proof | ZKP (Schnorr) | Prove ownership without revealing key |
| Storage | AWS S3 | Encrypted file storage |
| Auth | AWS Cognito | User identity & JWT tokens |
