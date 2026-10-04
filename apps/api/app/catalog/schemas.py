"""Catalog schemas for programs, divisions, and standings."""

from pydantic import BaseModel


class ProgramResponse(BaseModel):
    id: str
    name: str
    type: str
    startDate: str
    endDate: str
    status: str
    priceCents: int
    currency: str


class DivisionResponse(BaseModel):
    id: str
    programId: str
    name: str
    ratingBand: str
    playersCount: int
    genderConstraint: str = "open"
    minAge: int | None = None


class StandingRowResponse(BaseModel):
    rank: int
    playerId: str
    playerName: str
    homeArea: str
    isDaytime: bool
    wins: int
    losses: int
    gamesWon: int
    gamesLost: int
    gamesPct: float
    gamesPctDisplay: str
    playoffIndicator: str
    isPlayoffEligible: bool
