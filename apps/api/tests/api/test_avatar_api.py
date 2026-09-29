"""Tests for avatar upload URL generation, validation, and profile photo updates."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


async def get_test_auth_headers(
    client: AsyncClient, email: str = "avatar_test@example.com"
) -> dict[str, str]:
    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "display_name": "Avatar Tester",
        "rating": "4.0",
        "home_area": "Bornheim",
    }
    res = await client.post("/auth/register", json=payload)
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_avatar_upload_url_success(client: AsyncClient):
    headers = await get_test_auth_headers(client, "uploader1@example.com")
    res = await client.post(
        "/identity/avatar/upload-url",
        headers=headers,
        json={"content_type": "image/jpeg", "file_size_bytes": 1024 * 50},
    )
    assert res.status_code == 200
    data = res.json()
    assert "upload_url" in data
    assert "public_url" in data
    assert "avatars/" in data["public_url"]


@pytest.mark.asyncio
async def test_avatar_upload_oversized_rejected(client: AsyncClient):
    headers = await get_test_auth_headers(client, "oversized@example.com")
    res = await client.post(
        "/identity/avatar/upload-url",
        headers=headers,
        json={"content_type": "image/jpeg", "file_size_bytes": 3 * 1024 * 1024},  # 3 MB > 2 MB
    )
    assert res.status_code == 400
    assert "exceeds maximum limit of 2 MB" in res.json()["detail"]


@pytest.mark.asyncio
async def test_avatar_upload_invalid_mime_rejected(client: AsyncClient):
    headers = await get_test_auth_headers(client, "invalidmime@example.com")
    res = await client.post(
        "/identity/avatar/upload-url",
        headers=headers,
        json={"content_type": "image/gif", "file_size_bytes": 50000},
    )
    assert res.status_code == 400
    assert "Invalid image type" in res.json()["detail"]


@pytest.mark.asyncio
async def test_avatar_profile_update_and_retrieval(client: AsyncClient):
    headers = await get_test_auth_headers(client, "updater@example.com")

    # Initially null
    me_res = await client.get("/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["profile"]["avatar_url"] is None

    # Update profile with new avatar URL
    test_url = "https://cdn.tennis-league.de/avatars/user-123/12345.jpg"
    patch_res = await client.patch(
        "/me/profile",
        headers=headers,
        json={"avatar_url": test_url},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["avatar_url"] == test_url

    # Check /me reflects the new avatar
    me_updated = await client.get("/me", headers=headers)
    assert me_updated.status_code == 200
    assert me_updated.json()["profile"]["avatar_url"] == test_url

    # Replace with a second avatar (testing replacement)
    test_url_2 = "https://cdn.tennis-league.de/avatars/user-123/67890.jpg"
    patch_res_2 = await client.patch(
        "/identity/profile",
        headers=headers,
        json={"avatar_url": test_url_2},
    )
    assert patch_res_2.status_code == 200
    assert patch_res_2.json()["avatar_url"] == test_url_2


@pytest.mark.asyncio
async def test_avatar_upload_unauthenticated(client: AsyncClient):
    res = await client.post(
        "/identity/avatar/upload-url",
        json={"content_type": "image/jpeg", "file_size_bytes": 1000},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_avatar_replacement_deletes_old_r2_object(client: AsyncClient):
    """Verify replacing an avatar invokes R2 delete_object on the previous file key, not the new one."""
    headers = await get_test_auth_headers(client, "r2cleanup@example.com")

    # Get user id to construct realistic R2 storage keys
    me_res = await client.get("/me", headers=headers)
    assert me_res.status_code == 200
    user_id = me_res.json()["id"]

    old_key = f"avatars/{user_id}/1720000000.jpg"
    old_url = f"https://cdn.tennis-league.de/{old_key}"

    new_key = f"avatars/{user_id}/1720001000.jpg"
    new_url = f"https://cdn.tennis-league.de/{new_key}"

    # Set initial avatar photo
    init_res = await client.patch(
        "/me/profile",
        headers=headers,
        json={"avatar_url": old_url},
    )
    assert init_res.status_code == 200
    assert init_res.json()["avatar_url"] == old_url

    # Mock R2 client to verify delete_object call
    mock_s3 = MagicMock()
    with patch("app.identity.storage.get_r2_s3_client", return_value=mock_s3):
        replace_res = await client.patch(
            "/me/profile",
            headers=headers,
            json={"avatar_url": new_url},
        )
        assert replace_res.status_code == 200
        assert replace_res.json()["avatar_url"] == new_url

        # Verify delete_object was called exactly once with the old object key
        mock_s3.delete_object.assert_called_once()
        _, call_kwargs = mock_s3.delete_object.call_args
        assert call_kwargs["Key"] == old_key
        assert call_kwargs["Key"] != new_key
