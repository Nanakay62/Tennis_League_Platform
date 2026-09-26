"""Integration tests for identity, authentication, profile, and settings endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_user_success(client: AsyncClient):
    payload = {
        "email": "player1@example.com",
        "password": "SecurePassword123!",
        "display_name": "Lukas Becker",
        "phone": "+49 69 123456",
        "rating": "3.5",
        "home_area": "Sachsenhausen",
        "is_daytime": True,
        "market_slug": "frankfurt",
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "SecurePassword123!",
        "display_name": "Lukas Becker",
    }
    res1 = await client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_login_success_and_invalid_password(client: AsyncClient):
    payload = {
        "email": "login_test@example.com",
        "password": "CorrectPassword123!",
        "display_name": "Elena Weber",
    }
    await client.post("/auth/register", json=payload)

    # Valid login
    login_res = await client.post(
        "/auth/login",
        json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Invalid password
    bad_login = await client.post(
        "/auth/login",
        json={"email": "login_test@example.com", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_reuse_revocation(client: AsyncClient):
    payload = {
        "email": "rotation_test@example.com",
        "password": "Password123!",
        "display_name": "Max Rotation",
    }
    reg_res = await client.post("/auth/register", json=payload)
    initial_tokens = reg_res.json()
    old_refresh = initial_tokens["refresh_token"]

    # 1. Rotate token
    rotate_res = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert rotate_res.status_code == 200
    new_tokens = rotate_res.json()
    new_refresh = new_tokens["refresh_token"]
    assert new_refresh != old_refresh

    # 2. Token reuse detection: attempting to use the old refresh token again
    reuse_res = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == 401
    assert "reuse detected" in reuse_res.json()["detail"].lower()

    # 3. Family revocation: the newly issued token in the compromised family should now also be revoked
    compromised_res = await client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert compromised_res.status_code == 401


@pytest.mark.asyncio
async def test_get_me_and_update_profile(client: AsyncClient):
    payload = {
        "email": "profile_user@example.com",
        "password": "Password123!",
        "display_name": "Felix Fischer",
        "home_area": "Bornheim",
    }
    reg_res = await client.post("/auth/register", json=payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # GET /me
    me_res = await client.get("/me", headers=headers)
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["email"] == "profile_user@example.com"
    assert data["profile"]["display_name"] == "Felix Fischer"
    assert data["profile"]["home_area"] == "Bornheim"

    # PATCH /me/profile
    patch_res = await client.patch(
        "/me/profile",
        json={"display_name": "Felix F.", "is_daytime": True},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["display_name"] == "Felix F."
    assert updated["is_daytime"] is True


@pytest.mark.asyncio
async def test_communication_settings(client: AsyncClient):
    payload = {
        "email": "comms_user@example.com",
        "password": "Password123!",
        "display_name": "Comms User",
    }
    reg_res = await client.post("/auth/register", json=payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # GET /me/communication-settings
    get_res = await client.get("/me/communication-settings", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["email_kickoff"] is True

    # PUT /me/communication-settings
    put_res = await client.put(
        "/me/communication-settings",
        json={"email_kickoff": False, "push_reminders": False},
        headers=headers,
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["email_kickoff"] is False
    assert updated["push_reminders"] is False


@pytest.mark.asyncio
async def test_delete_my_data_anonymizes_account(client: AsyncClient):
    payload = {
        "email": "delete_me@example.com",
        "password": "Password123!",
        "display_name": "Stefan ToDelete",
        "phone": "+49 170 999999",
    }
    reg_res = await client.post("/auth/register", json=payload)
    token = reg_res.json()["access_token"]
    refresh = reg_res.json()["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # DELETE /me
    del_res = await client.delete("/me", headers=headers)
    assert del_res.status_code == 204

    # The user should no longer be able to log in or use the account
    login_attempt = await client.post(
        "/auth/login", json={"email": "delete_me@example.com", "password": "Password123!"}
    )
    assert login_attempt.status_code == 401

    # Refresh tokens should be revoked
    refresh_attempt = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert refresh_attempt.status_code == 401


@pytest.mark.asyncio
async def test_app_version_endpoint(client: AsyncClient):
    res = await client.get("/app/version?platform=ios")
    assert res.status_code == 200
    data = res.json()
    assert data["platform"] == "ios"
    assert data["current_version"] == "1.0.0"
    assert data["is_update_required"] is False
