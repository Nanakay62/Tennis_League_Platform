"""Playoff tournaments, brackets, and single-elimination matches database models."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class BracketType(StrEnum):
    CHAMPIONSHIP = "championship"
    CONSOLATION = "consolation"


class BracketStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"


class PlayoffBracket(Base):
    __tablename__ = "playoff_brackets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    division_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bracket_type: Mapped[str] = mapped_column(
        String(30), default=BracketType.CHAMPIONSHIP, nullable=False
    )
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    total_rounds: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=BracketStatus.ACTIVE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    matches: Mapped[list["PlayoffMatch"]] = relationship(
        "PlayoffMatch", back_populates="bracket", cascade="all, delete-orphan"
    )


class PlayoffMatch(Base):
    __tablename__ = "playoff_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bracket_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("playoff_brackets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    match_number: Mapped[int] = mapped_column(Integer, nullable=False)
    player1_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="SET NULL"), nullable=True
    )
    player2_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="SET NULL"), nullable=True
    )
    winner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("player_profiles.id", ondelete="SET NULL"), nullable=True
    )
    score_summary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_bye: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_match_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    bracket: Mapped["PlayoffBracket"] = relationship("PlayoffBracket", back_populates="matches")
