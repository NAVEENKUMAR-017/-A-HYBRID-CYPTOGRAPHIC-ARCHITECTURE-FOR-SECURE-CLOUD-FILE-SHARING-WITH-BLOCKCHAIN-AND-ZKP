"""
storage/s3_client.py
---------------------
AWS S3 operations for encrypted file storage.
All files are stored pre-encrypted - S3 never sees plaintext.
"""

import json
import os

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "secure-file-share-bucket1")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def _get_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def upload_encrypted_file(
    file_id: str,
    ciphertext_b64: str,
    enc_aes_key_b64: str,
    iv_b64: str,
    tag_b64: str,
    file_name: str,
    owner_id: str,
) -> str:
    """
    Upload encrypted file + metadata to S3.
    Stores two objects:
      - {file_id}/ciphertext
      - {file_id}/metadata.json
    """
    s3 = _get_client()

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=f"{file_id}/ciphertext",
        Body=ciphertext_b64.encode(),
        ContentType="application/octet-stream",
        Metadata={"owner": owner_id},
        ServerSideEncryption="AES256",
    )

    metadata = {
        "file_id": file_id,
        "file_name": file_name,
        "owner_id": owner_id,
        "enc_aes_key": enc_aes_key_b64,
        "iv": iv_b64,
        "tag": tag_b64,
    }
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=f"{file_id}/metadata.json",
        Body=json.dumps(metadata).encode(),
        ContentType="application/json",
        ServerSideEncryption="AES256",
    )

    return file_id


def upload_reenc_bundle(file_id: str, delegate_id: str, bundle_json: str) -> str:
    s3 = _get_client()
    key = f"{file_id}/reenc/{delegate_id}.json"
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=bundle_json.encode(),
        ContentType="application/json",
        ServerSideEncryption="AES256",
    )
    return key


def download_encrypted_file(file_id: str) -> tuple[str, dict]:
    s3 = _get_client()

    cipher_obj = s3.get_object(Bucket=BUCKET_NAME, Key=f"{file_id}/ciphertext")
    ciphertext_b64 = cipher_obj["Body"].read().decode()

    meta_obj = s3.get_object(Bucket=BUCKET_NAME, Key=f"{file_id}/metadata.json")
    metadata = json.loads(meta_obj["Body"].read().decode())

    return ciphertext_b64, metadata


def download_reenc_bundle(file_id: str, delegate_id: str) -> dict:
    s3 = _get_client()
    key = f"{file_id}/reenc/{delegate_id}.json"
    obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
    return json.loads(obj["Body"].read().decode())


def delete_file(file_id: str) -> bool:
    s3 = _get_client()
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET_NAME, Prefix=f"{file_id}/")

    objects = []
    for page in pages:
        for obj in page.get("Contents", []):
            objects.append({"Key": obj["Key"]})

    if objects:
        s3.delete_objects(Bucket=BUCKET_NAME, Delete={"Objects": objects})
    return True


def list_user_files(owner_id: str) -> list[dict]:
    s3 = _get_client()
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET_NAME)

    files = []
    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith("metadata.json"):
                continue

            meta_obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            metadata = json.loads(meta_obj["Body"].read().decode())
            if metadata.get("owner_id") == owner_id:
                files.append(metadata)

    return files


def list_shared_files(delegate_id: str) -> list[dict]:
    s3 = _get_client()
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET_NAME)

    shared_files = []
    seen_file_ids = set()

    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(f"/reenc/{delegate_id}.json"):
                continue

            bundle_obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            bundle = json.loads(bundle_obj["Body"].read().decode())
            file_id = bundle.get("file_id")
            if not file_id or file_id in seen_file_ids:
                continue

            try:
                meta_obj = s3.get_object(Bucket=BUCKET_NAME, Key=f"{file_id}/metadata.json")
            except ClientError:
                continue

            metadata = json.loads(meta_obj["Body"].read().decode())
            metadata["shared_with_me"] = True
            metadata["shared_by"] = bundle.get("owner")
            shared_files.append(metadata)
            seen_file_ids.add(file_id)

    return shared_files


def file_exists(file_id: str) -> bool:
    s3 = _get_client()
    try:
        s3.head_object(Bucket=BUCKET_NAME, Key=f"{file_id}/metadata.json")
        return True
    except ClientError:
        return False
