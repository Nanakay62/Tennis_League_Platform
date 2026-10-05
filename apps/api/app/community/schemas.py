"""Pydantic schemas for courts directory, partner matching, POTY leaderboard, and referrals."""

from pydantic import BaseModel, Field


class CourtReviewResponse(BaseModel):
    id: str
    user_id: str
    rating: int
    comment: str | None = None
    created_at: str


class CreateCourtReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class CourtResponse(BaseModel):
    id: str
    name: str
    slug: str
    address: str
    postal_code: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
    num_courts: int
    surface: str
    has_lights: bool
    is_indoor: bool
    has_hitting_wall: bool
    booking_url: str | None = None
    average_rating: float = 0.0
    review_count: int = 0


class CourtDetailResponse(CourtResponse):
    reviews: list[CourtReviewResponse] = []


class PartnerMatchResponse(BaseModel):
    player_id: str
    display_name: str
    rating: str | None = None
    home_area: str | None = None
    is_daytime: bool = False
    phone: str | None = None
    email: str | None = None


class POTYItemResponse(BaseModel):
    rank: int
    player_id: str
    display_name: str
    total_points: int
    matches_played: int
    matches_won: int
    distinct_opponents: int
    home_area: str | None = None


class ReferralInfoResponse(BaseModel):
    referral_code: str
    referral_link: str
    reward_credit_cents: int
    completed_referrals_count: int
    pending_referrals_count: int
