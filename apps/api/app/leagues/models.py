"""League enrollment and standings database models."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EnrollmentStatus(StrEnum):
    CART = "cart"
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    PLACED_IN_DIVISION = "placed_in_division"
    WITHDRAWN = "withdrawn"
    REMOVED = "removed"
    REFUNDED = "refunded"


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "program_id", name="uq_enrollments_user_program"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    division_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("divisions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(30), default=EnrollmentStatus.ACTIVE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class StandingRowModel(Base):
    __tablename__ = "standing_rows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    division_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    player_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    games_won: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    games_lost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distinct_opponents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_playoff_eligible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    playoff_indicator: Mapped[str] = mapped_column(String(10), default="0", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
