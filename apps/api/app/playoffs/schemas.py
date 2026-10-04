"""Pydantic schemas for tournament playoffs and bracket trees."""

from pydantic import BaseModel


class PlayoffPlayerSummary(BaseModel):
    id: str
    display_name: str
    seed_number: int | None = None


class PlayoffMatchResponse(BaseModel):
    id: str
    round_number: int
    match_number: int
    player1: PlayoffPlayerSummary | None = None
    player2: PlayoffPlayerSummary | None = None
    winner: PlayoffPlayerSummary | None = None
    score_summary: str | None = None
    is_bye: bool = False
    deadline: str | None = None
    next_match_id: str | None = None


class PlayoffBracketResponse(BaseModel):
    id: str
    division_id: str
    bracket_type: str
    bracket_size: int
    total_rounds: int
    status: str
    rounds: dict[str, list[PlayoffMatchResponse]]  # e.g. "1": [...], "2": [...]


class ReportPlayoffScoreRequest(BaseModel):
    winner_id: str
    score_summary: str


class GeneratePlayoffsRequest(BaseModel):
    enable_veteran_seeding: bool = True
