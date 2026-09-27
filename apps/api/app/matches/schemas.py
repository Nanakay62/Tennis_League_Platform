"""Pydantic schemas for match submission, confirmation, disputes, rosters, and scores feed."""

from pydantic import BaseModel, Field


class SetScoreInput(BaseModel):
    winner: int = Field(ge=0, le=99)
    loser: int = Field(ge=0, le=99)
    super_tiebreak: bool = False


class SubmitMatchRequest(BaseModel):
    division_id: str
    opponent_id: str  # PlayerProfile id of opponent
    i_am_winner: bool = True
    format: str = "best_of_three"  # best_of_three, match_tiebreak, pro_set_10, fast4
    outcome_type: str = "played"  # played, retired, no_show, late_cancel
    sets: list[SetScoreInput] = Field(default_factory=list)
    minutes_waited: int | None = None  # for no_show
    hours_before_match: float | None = None  # for late_cancel
    is_rain_exempt: bool = False


class MatchResponse(BaseModel):
    id: str
    division_id: str
    winner_id: str
    loser_id: str
    winner_name: str
    loser_name: str
    format: str
    outcome_type: str
    sets_summary: str
    status: str
    played_at: str


class DisputeMatchRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)


class RosterPlayerResponse(BaseModel):
    player_id: str
    display_name: str
    phone: str
    email: str
    rating: str
    home_area: str
    is_daytime: bool


class LatestScoreFeedItem(BaseModel):
    id: str
    winner_name: str
    loser_name: str
    score_line: str
    division_name: str
    date_str: str
