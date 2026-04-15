# AWS Setup Guide

Complete step-by-step instructions to configure AWS S3 and Cognito for SecureShare.

---

## Part 1 — AWS S3

### 1.1 Create the bucket

1. Go to **AWS Console → S3 → Create bucket**
2. **Bucket name**: `secure-file-share-bucket` (or any name — update `S3_BUCKET_NAME` in `.env`)
3. **Region**: choose your region (update `AWS_REGION` in `.env`)
4. **Block all public access**: ✅ ON (all four checkboxes)
5. **Versioning**: optional but recommended
6. **Default encryption**: SSE-S3 (AES-256) — adds a second encryption layer on top of our AES-GCM
7. Click **Create bucket**

### 1.2 IAM user for the backend

1. Go to **IAM → Users → Create user**
2. Name: `secureshare-backend`
3. **Permissions**: Attach policy directly → Create inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:HeadObject"
      ],
      "Resource": [
        "arn:aws:s3:::secure-file-share-bucket",
        "arn:aws:s3:::secure-file-share-bucket/*"
      ]
    }
  ]
}
```

4. After creating the user, go to **Security credentials → Create access key**
5. Select **Application running outside AWS**
6. Copy **Access Key ID** and **Secret Access Key** → paste into `.env`

---

## Part 2 — AWS Cognito

### 2.1 Create a User Pool

1. Go to **Cognito → User pools → Create user pool**
2. **Sign-in options**: ✅ Email
3. **Password policy**: Cognito defaults are fine
4. **MFA**: Optional (No MFA for dev)
5. **Required attributes**: email
6. **Email delivery**: Cognito (free tier sends up to 50 emails/day)
7. **User pool name**: `secureshare-users`
8. Click through to **Create user pool**
9. Copy the **User pool ID** (format: `us-east-1_XXXXXXXXX`) → `.env` as `COGNITO_USER_POOL_ID`

### 2.2 Create an App Client

1. Inside your user pool → **App clients → Create app client**
2. **App type**: Public client (no secret — browser SPA)
3. **App client name**: `secureshare-web`
4. **Authentication flows**: ✅ `ALLOW_USER_PASSWORD_AUTH`, ✅ `ALLOW_REFRESH_TOKEN_AUTH`
5. **Allowed callback URLs**: `http://localhost:5173`
6. **Allowed sign-out URLs**: `http://localhost:5173`
7. Click **Create**
8. Copy the **Client ID** → `.env` as `COGNITO_APP_CLIENT_ID`

### 2.3 Final .env values

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=secure-file-share-bucket

COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=us-east-1
```

---

## Part 3 — Ganache (local blockchain)

```bash
# Install globally
npm install -g ganache

# Start with deterministic accounts
ganache --port 8545 --deterministic

# Copy the first account's private key (printed on start)
# Paste it into .env as DEPLOYER_PRIVATE_KEY
```

Then deploy the smart contract:

```bash
cd backend
source venv/bin/activate
python deploy_contract.py
# CONTRACT_ADDRESS is written back to .env automatically
```

---

## Security notes

- The backend **never stores plaintext files or private keys**
- S3 stores AES-GCM ciphertext + SSE-S3 on top = double encrypted at rest
- Cognito JWTs are verified against the JWKS endpoint on every request
- The Ethereum private key is only used to sign blockchain transactions — no ETH value is transferred
- For production: use AWS Secrets Manager for `DEPLOYER_PRIVATE_KEY` and rotate regularly
