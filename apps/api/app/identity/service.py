"""Identity and user management service operations."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.identity.models import CommunicationPreference, PlayerProfile, RefreshToken, User, UserRole
from app.identity.schemas import (
    CommunicationSettingsUpdate,
    PlayerProfileUpdate,
    TokenResponse,
    UserRegisterRequest,
)
from app.identity.security import (
    create_access_token,
    generate_raw_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.markets.models import Market

settings = get_settings()


async def get_or_create_default_market(session: AsyncSession) -> Market:
    """Ensure the default Frankfurt market exists."""
    stmt = select(Market).where(Market.slug == "frankfurt")
    res = await session.execute(stmt)
    market = res.scalar_one_or_none()
    if not market:
        market = Market(
            name="Frankfurt",
            slug="frankfurt",
            timezone="Europe/Berlin",
            currency="EUR",
        )
        session.add(market)
        await session.flush()
    return market


async def register_user(
    session: AsyncSession, req: UserRegisterRequest
) -> tuple[User, TokenResponse]:
    """Register a new user, profile, and initial communication preferences."""
    # Check if email already registered
    existing_stmt = select(User).where(User.email == req.email.lower())
    res = await session.execute(existing_stmt)
    if res.scalar_one_or_none():
        raise ValueError("An account with this email address already exists.")

    market = await get_or_create_default_market(session)

    user = User(
        market_id=market.id,
        email=req.email.lower(),
        hashed_password=hash_password(req.password),
        role=UserRole.PLAYER,
        is_active=True,
    )
    session.add(user)
    await session.flush()

    profile = PlayerProfile(
        user_id=user.id,
        market_id=market.id,
        display_name=req.display_name,
        phone=req.phone,
        rating=req.rating,
        home_area=req.home_area,
        is_daytime=req.is_daytime,
    )
    session.add(profile)

    comms = CommunicationPreference(user_id=user.id)
    session.add(comms)

    # Issue tokens
    tokens = await issue_token_pair(session, user)
    return user, tokens


async def authenticate_user(
    session: AsyncSession, email: str, password: str
) -> tuple[User, TokenResponse]:
    """Authenticate credentials and return user + tokens."""
    stmt = select(User).where(User.email == email.lower()).options(selectinload(User.profile))
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password.")

    tokens = await issue_token_pair(session, user)
    return user, tokens


async def issue_token_pair(
    session: AsyncSession, user: User, family_id: str | None = None
) -> TokenResponse:
    """Generate and store access and refresh tokens."""
    access_token = create_access_token(
        data={"sub": user.id, "market_id": user.market_id, "role": user.role}
    )

    raw_refresh = generate_raw_refresh_token()
    token_family = family_id or str(uuid.uuid4())
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_entity = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        family_id=token_family,
        revoked=False,
        expires_at=expires_at,
    )
    session.add(refresh_entity)
    await session.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def rotate_refresh_token(session: AsyncSession, raw_refresh_token: str) -> TokenResponse:
    """Rotate refresh token. If a revoked token is used, revoke the entire family (reuse attack)."""
    hashed = hash_token(raw_refresh_token)
    stmt = (
        select(RefreshToken)
        .where(RefreshToken.token_hash == hashed)
        .options(selectinload(RefreshToken.user))
    )
    res = await session.execute(stmt)
    token_entity = res.scalar_one_or_none()

    if not token_entity:
        raise ValueError("Invalid refresh token.")

    # Check if token family was already compromised (token reuse detection)
    if token_entity.revoked:
        # Revoke all tokens in this family
        revoke_stmt = select(RefreshToken).where(RefreshToken.family_id == token_entity.family_id)
        tokens_to_revoke = (await session.execute(revoke_stmt)).scalars().all()
        for t in tokens_to_revoke:
            t.revoked = True
        await session.commit()
        raise ValueError("Token reuse detected. All sessions in this family have been terminated.")

    # Check expiration
    expires_at = token_entity.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        token_entity.revoked = True
        await session.flush()
        raise ValueError("Refresh token expired.")

    # Revoke current token
    token_entity.revoked = True
    await session.flush()

    # Issue new token pair preserving the family ID
    return await issue_token_pair(session, token_entity.user, family_id=token_entity.family_id)


async def revoke_refresh_token(session: AsyncSession, raw_refresh_token: str) -> None:
    """Revoke a single refresh token on logout."""
    hashed = hash_token(raw_refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == hashed)
    res = await session.execute(stmt)
    token_entity = res.scalar_one_or_none()
    if token_entity:
        token_entity.revoked = True
        await session.flush()


async def get_user_with_relations(session: AsyncSession, user_id: str) -> User | None:
    """Fetch user by id with profile and communication settings loaded."""
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.profile), selectinload(User.communication_settings))
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_player_profile(
    session: AsyncSession, user_id: str, updates: PlayerProfileUpdate
) -> PlayerProfile:
    """Update profile attributes."""
    stmt = select(PlayerProfile).where(PlayerProfile.user_id == user_id)
    res = await session.execute(stmt)
    profile = res.scalar_one_or_none()
    if not profile:
        raise ValueError("Profile not found.")

    if updates.display_name is not None:
        profile.display_name = updates.display_name
    if updates.phone is not None:
        profile.phone = updates.phone
    if updates.home_area is not None:
        profile.home_area = updates.home_area
    if updates.is_daytime is not None:
        profile.is_daytime = updates.is_daytime
    if updates.avatar_url is not None:
        old_avatar = profile.avatar_url
        if old_avatar and old_avatar != updates.avatar_url:
            from app.identity.storage import delete_avatar_from_r2

            delete_avatar_from_r2(user_id, old_avatar)
        profile.avatar_url = updates.avatar_url

    await session.flush()
    return profile


async def update_communication_preferences(
    session: AsyncSession, user_id: str, updates: CommunicationSettingsUpdate
) -> CommunicationPreference:
    """Update notification preferences."""
    stmt = select(CommunicationPreference).where(CommunicationPreference.user_id == user_id)
    res = await session.execute(stmt)
    comms = res.scalar_one_or_none()
    if not comms:
        raise ValueError("Communication preferences not found.")

    for field, val in updates.model_dump(exclude_unset=True).items():
        setattr(comms, field, val)

    await session.flush()
    return comms


async def delete_and_anonymize_user(session: AsyncSession, user_id: str) -> None:
    """Delete account in compliance with Apple/GDPR requirements:
    Scrub personal data, anonymize match records as 'Former Player', and deactivate.
    """
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.profile), selectinload(User.refresh_tokens))
    )
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise ValueError("User not found.")

    # Delete avatar from R2 storage if exists
    if user.profile and user.profile.avatar_url:
        from app.identity.storage import delete_avatar_from_r2

        delete_avatar_from_r2(user_id, user.profile.avatar_url)

    # Scrub email and password
    user.email = f"deleted-{user.id}@anonymized.local"
    user.hashed_password = "DELETED"
    user.is_active = False

    # Anonymize profile so historical results and standings remain intact
    if user.profile:
        user.profile.display_name = "Former Player"
        user.profile.phone = ""
        user.profile.home_area = ""
        user.profile.is_anonymized = True
        user.profile.avatar_url = None

    # Revoke all refresh tokens
    for token in user.refresh_tokens:
        token.revoked = True

    await session.flush()
