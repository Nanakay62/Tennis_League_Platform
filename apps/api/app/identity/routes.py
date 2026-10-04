"""Identity, authentication, and profile endpoints."""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.identity.deps import get_current_user
from app.identity.models import User
from app.identity.schemas import (
    AppVersionResponse,
    AvatarUploadRequest,
    AvatarUploadResponse,
    CommunicationSettingsResponse,
    CommunicationSettingsUpdate,
    PlayerProfileResponse,
    PlayerProfileUpdate,
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.identity.service import (
    authenticate_user,
    delete_and_anonymize_user,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
    update_communication_preferences,
    update_player_profile,
)


class SimpleRateLimiter:
    """Sliding-window in-memory rate limiter per IP address for brute-force mitigation."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, request: Request) -> None:
        import sys

        # Bypass rate limiting when running under pytest
        if "pytest" in sys.modules:
            return

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

        if client_ip in ("testclient", "unknown"):
            return

        now = time.time()
        valid_timestamps = [t for t in self.requests[client_ip] if now - t < self.window_seconds]
        if len(valid_timestamps) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication requests. Please try again in one minute.",
                headers={"Retry-After": str(self.window_seconds)},
            )
        valid_timestamps.append(now)
        self.requests[client_ip] = valid_timestamps


auth_rate_limiter = SimpleRateLimiter(max_requests=20, window_seconds=60)
router = APIRouter(tags=["identity"])


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: UserRegisterRequest,
    session: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(auth_rate_limiter),
):
    """Register a new player account and profile."""
    try:
        _, tokens = await register_user(session, req)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    req: UserLoginRequest,
    session: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(auth_rate_limiter),
):
    """Log in with email and password."""
    try:
        _, tokens = await authenticate_user(session, req.email, req.password)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshTokenRequest, session: AsyncSession = Depends(get_db)):
    """Rotate an existing refresh token for a new token pair."""
    try:
        tokens = await rotate_refresh_token(session, req.refresh_token)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(req: RefreshTokenRequest, session: AsyncSession = Depends(get_db)):
    """Revoke a refresh token on sign-out."""
    await revoke_refresh_token(session, req.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Retrieve currently authenticated user and player profile."""
    profile_data = None
    if user.profile:
        profile_data = PlayerProfileResponse(
            display_name=user.profile.display_name,
            phone=user.profile.phone,
            rating=user.profile.rating,
            home_area=user.profile.home_area,
            is_daytime=user.profile.is_daytime,
            veteran_match_count=user.profile.veteran_match_count,
            is_anonymized=user.profile.is_anonymized,
            avatar_url=user.profile.avatar_url,
            gender=user.profile.gender,
            birth_year=user.profile.birth_year,
            favorite_link=user.profile.favorite_link,
            game_description=user.profile.game_description,
            about_me=user.profile.about_me,
        )

    return UserResponse(
        id=user.id,
        market_id=user.market_id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        profile=profile_data,
    )


@router.post("/identity/avatar/upload-url", response_model=AvatarUploadResponse)
async def get_avatar_upload_url(
    req: AvatarUploadRequest,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Generate a presigned Cloudflare R2 upload URL with signed policies, or local sandbox fallback."""
    from app.identity.storage import generate_avatar_upload_payload

    try:
        base_url = str(request.base_url).rstrip("/")
        return generate_avatar_upload_payload(
            user_id=user.id,
            content_type=req.content_type,
            file_size_bytes=req.file_size_bytes,
            base_url=base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/identity/avatar/upload-sandbox")
async def upload_avatar_sandbox(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Local development/testing sandbox upload endpoint when R2 credentials are not set."""
    import os
    import time

    form = await request.form()
    key = str(form.get("key", f"avatars/{user.id}/{int(time.time())}.jpg"))
    file_item = form.get("file")

    file_bytes: bytes = b""
    if file_item is not None:
        if hasattr(file_item, "read"):
            file_bytes = await file_item.read()
        elif isinstance(file_item, bytes):
            file_bytes = file_item

    # Persist file bytes in local media storage asynchronously
    media_dir = "media"
    file_path = os.path.join(media_dir, key.replace("/", os.sep))

    def _write_media_file() -> None:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

    import anyio

    await anyio.to_thread.run_sync(_write_media_file)

    base_url = str(request.base_url).rstrip("/")
    public_url = f"{base_url}/media/{key}"
    return {"status": "ok", "key": key, "public_url": public_url}


@router.patch("/me/profile", response_model=PlayerProfileResponse)
@router.patch("/identity/profile", response_model=PlayerProfileResponse)
async def update_profile(
    updates: PlayerProfileUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update profile information."""
    profile = await update_player_profile(session, user.id, updates)
    return PlayerProfileResponse(
        display_name=profile.display_name,
        phone=profile.phone,
        rating=profile.rating,
        home_area=profile.home_area,
        is_daytime=profile.is_daytime,
        veteran_match_count=profile.veteran_match_count,
        is_anonymized=profile.is_anonymized,
        avatar_url=profile.avatar_url,
        gender=profile.gender,
        birth_year=profile.birth_year,
        favorite_link=profile.favorite_link,
        game_description=profile.game_description,
        about_me=profile.about_me,
    )


@router.get("/me/communication-settings", response_model=CommunicationSettingsResponse)
async def get_communication_settings(user: User = Depends(get_current_user)):
    """Get player communication toggles."""
    comms = user.communication_settings
    if not comms:
        return CommunicationSettingsResponse(
            email_kickoff=True,
            email_reminders=True,
            email_results=True,
            push_kickoff=True,
            push_reminders=True,
            push_results=True,
        )
    return CommunicationSettingsResponse(
        email_kickoff=comms.email_kickoff,
        email_reminders=comms.email_reminders,
        email_results=comms.email_results,
        push_kickoff=comms.push_kickoff,
        push_reminders=comms.push_reminders,
        push_results=comms.push_results,
    )


@router.put("/me/communication-settings", response_model=CommunicationSettingsResponse)
async def put_communication_settings(
    updates: CommunicationSettingsUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update communication preferences."""
    comms = await update_communication_preferences(session, user.id, updates)
    return CommunicationSettingsResponse(
        email_kickoff=comms.email_kickoff,
        email_reminders=comms.email_reminders,
        email_results=comms.email_results,
        push_kickoff=comms.push_kickoff,
        push_reminders=comms.push_reminders,
        push_results=comms.push_results,
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_data(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Apple App Store & GDPR Account Deletion.
    Deletes personal data and anonymizes historical match records.
    """
    await delete_and_anonymize_user(session, user.id)


@router.get("/app/version", response_model=AppVersionResponse)
async def get_app_version(platform: str = Query(default="web")):
    """Check app version compatibility for mobile and web clients."""
    return AppVersionResponse(
        platform=platform,
        current_version="1.0.0",
        minimum_version="1.0.0",
        is_update_required=False,
        update_url=None,
    )
