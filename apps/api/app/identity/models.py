"""Identity, authentication, and user profile database models."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(StrEnum):
    GUEST = "guest"
    PLAYER = "player"
    MARKET_ADMIN = "market_admin"
    SUPER_ADMIN = "super_admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default=UserRole.PLAYER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    profile: Mapped["PlayerProfile"] = relationship(
        "PlayerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    communication_settings: Mapped["CommunicationPreference"] = relationship(
        "CommunicationPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    rating: Mapped[str] = mapped_column(
        String(10), default="3.5", nullable=False
    )  # 3.0, 3.5, 4.0, etc.
    home_area: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    is_daytime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # (d) flag
    veteran_match_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_anonymized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)

    user: Mapped["User"] = relationship("User", back_populates="profile")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


class CommunicationPreference(Base):
    __tablename__ = "communication_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    email_kickoff: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_results: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_kickoff: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_results: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="communication_settings")
