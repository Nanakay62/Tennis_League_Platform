"""Program catalog and division database models."""

import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ProgramType(StrEnum):
    FLEX_SEASON = "flex_season"
    MINI_SEASON = "mini_season"
    TOURNEY = "tourney"
    PARTNER_PROGRAM = "partner_program"
    PACKAGE = "package"


class ProgramStatus(StrEnum):
    OPEN = "Open for Enrollment"
    STARTED_ACCEPTING = "Season started, still accepting players"
    CLOSED = "Closed for New Players"


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), nullable=False)
    program_type: Mapped[str] = mapped_column(
        String(30), default=ProgramType.FLEX_SEASON, nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=ProgramStatus.OPEN, nullable=False)
    price_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3495
    )  # e.g. 3495 = €34.95
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    divisions: Mapped[list["Division"]] = relationship(
        "Division", back_populates="program", cascade="all, delete-orphan"
    )


class Division(Base):
    __tablename__ = "divisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    market_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    rating_band: Mapped[str] = mapped_column(String(20), nullable=False)  # "3.5", "3.0", "4.0+"
    playoff_min_wins: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    new_player_min_matches: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    program: Mapped["Program"] = relationship("Program", back_populates="divisions")
