"""Avatar image validation, storage, and Cloudflare R2 presigned upload management."""

import contextlib
import os
import time
from typing import Any

from app.config import get_settings
from app.identity.schemas import AvatarUploadResponse

settings = get_settings()

ALLOWED_AVATAR_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB limit


def validate_avatar_upload(content_type: str, file_size_bytes: int) -> None:
    """Validate content type and file size against strict avatar constraints."""
    if content_type not in ALLOWED_AVATAR_MIME_TYPES:
        allowed = ", ".join(sorted(ALLOWED_AVATAR_MIME_TYPES))
        raise ValueError(f"Invalid image type: '{content_type}'. Allowed types are {allowed}.")

    if file_size_bytes <= 0:
        raise ValueError("File size must be greater than 0 bytes.")

    if file_size_bytes > MAX_AVATAR_SIZE_BYTES:
        max_mb = MAX_AVATAR_SIZE_BYTES // (1024 * 1024)
        raise ValueError(
            f"File size ({file_size_bytes} bytes) exceeds maximum limit of {max_mb} MB."
        )


def get_r2_s3_client() -> Any | None:
    """Return boto3 client for Cloudflare R2 if credentials are configured, else None."""
    if (
        settings.AVATAR_R2_ACCESS_KEY_ID
        and settings.AVATAR_R2_SECRET_ACCESS_KEY
        and settings.AVATAR_R2_ENDPOINT_URL
    ):
        import boto3
        from botocore.config import Config

        return boto3.client(
            "s3",
            endpoint_url=settings.AVATAR_R2_ENDPOINT_URL,
            aws_access_key_id=settings.AVATAR_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AVATAR_R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return None


def generate_avatar_upload_payload(
    user_id: str, content_type: str, file_size_bytes: int, base_url: str = ""
) -> AvatarUploadResponse:
    """Generate an R2 presigned POST with policy conditions, or sandbox fallback for local dev."""
    validate_avatar_upload(content_type, file_size_bytes)

    timestamp = int(time.time())
    extension = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
    key = f"avatars/{user_id}/{timestamp}.{extension}"

    client = get_r2_s3_client()
    if client is not None:
        # Cryptographically signed S3/R2 policy enforced at upload time
        presigned = client.generate_presigned_post(
            Bucket=settings.AVATAR_R2_BUCKET,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                ["content-length-range", 1, MAX_AVATAR_SIZE_BYTES],
                {"Content-Type": content_type},
                ["starts-with", "$key", f"avatars/{user_id}/"],
            ],
            ExpiresIn=300,
        )

        public_base = (
            settings.AVATAR_PUBLIC_BASE_URL.rstrip("/")
            if settings.AVATAR_PUBLIC_BASE_URL
            else f"https://{settings.AVATAR_R2_BUCKET}.r2.cloudflarestorage.com"
        )
        public_url = f"{public_base}/{key}"

        return AvatarUploadResponse(
            upload_url=presigned["url"],
            public_url=public_url,
            fields=presigned.get("fields", {}),
            method="POST",
        )

    # Sandbox fallback when running locally or during test suites without R2 credentials
    media_url = f"{base_url.rstrip('/')}/media/{key}" if base_url else f"/media/{key}"
    return AvatarUploadResponse(
        upload_url="/identity/avatar/upload-sandbox",
        public_url=media_url,
        fields={"key": key, "Content-Type": content_type},
        method="POST",
    )


def delete_avatar_from_r2(user_id: str, avatar_url: str | None) -> bool:
    """Delete the previous avatar object from Cloudflare R2 if it belongs to this user."""
    if not avatar_url:
        return False

    prefix = f"avatars/{user_id}/"
    if prefix not in avatar_url:
        return False

    # Extract key from URL
    key = avatar_url[avatar_url.find(prefix) :]

    client = get_r2_s3_client()
    if client is not None:
        with contextlib.suppress(Exception):
            client.delete_object(Bucket=settings.AVATAR_R2_BUCKET, Key=key)
            return True

    # If local sandbox media file
    sandbox_path = os.path.join("media", key.replace("/", os.sep))
    if os.path.exists(sandbox_path):
        with contextlib.suppress(OSError):
            os.remove(sandbox_path)
            return True

    return False
