"""Match results, reporting, and audit logging database models."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MatchStatus(StrEnum):
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    DISPUTED = "disputed"
    VOIDED = "voided"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    division_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    winner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    loser_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    format: Mapped[str] = mapped_column(String(30), nullable=False)
    outcome_type: Mapped[str] = mapped_column(String(30), default="played", nullable=False)
    sets_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded array of set scores
    status: Mapped[str] = mapped_column(String(30), default=MatchStatus.CONFIRMED, nullable=False)
    reporter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    is_handicap: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    handicap_lead: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
    handicap_recipient_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("player_profiles.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # match, strike, placement, refund
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changes_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class StrikeStatus(StrEnum):
    PROPOSED = "proposed"
    CONFIRMED = "confirmed"
    APPEALED = "appealed"
    DISMISSED = "dismissed"


class Strike(Base):
    __tablename__ = "strikes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    match_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )
    points: Mapped[int] = mapped_column(nullable=False, default=1)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=StrikeStatus.PROPOSED, nullable=False)
    calendar_year: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class DisputeStatus(StrEnum):
    PENDING = "pending"
    RESOLVED_UPHELD = "resolved_upheld"
    RESOLVED_CHANGED = "resolved_changed"


class MatchDispute(Base):
    __tablename__ = "match_disputes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    disputer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    cooling_off_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=DisputeStatus.PENDING, nullable=False)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
