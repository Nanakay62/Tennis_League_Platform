"""Pydantic schemas for authentication, profiles, and settings."""

from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(default="", max_length=30)
    rating: str = Field(default="3.5")  # e.g. "3.0", "3.5", "4.0"
    home_area: str = Field(default="Sachsenhausen")
    is_daytime: bool = Field(default=False)
    market_slug: str = Field(default="frankfurt")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PlayerProfileResponse(BaseModel):
    display_name: str
    phone: str
    rating: str
    home_area: str
    is_daytime: bool
    veteran_match_count: int
    is_anonymized: bool
    avatar_url: str | None = None


class PlayerProfileUpdate(BaseModel):
    display_name: str | None = None
    phone: str | None = None
    home_area: str | None = None
    is_daytime: bool | None = None
    avatar_url: str | None = None


class AvatarUploadRequest(BaseModel):
    content_type: str
    file_size_bytes: int


class AvatarUploadResponse(BaseModel):
    upload_url: str
    public_url: str
    fields: dict[str, str] = Field(default_factory=dict)
    method: str = "POST"


class UserResponse(BaseModel):
    id: str
    market_id: str
    email: str
    role: str
    is_active: bool
    profile: PlayerProfileResponse | None = None


class CommunicationSettingsResponse(BaseModel):
    email_kickoff: bool
    email_reminders: bool
    email_results: bool
    push_kickoff: bool
    push_reminders: bool
    push_results: bool


class CommunicationSettingsUpdate(BaseModel):
    email_kickoff: bool | None = None
    email_reminders: bool | None = None
    email_results: bool | None = None
    push_kickoff: bool | None = None
    push_reminders: bool | None = None
    push_results: bool | None = None


class AppVersionResponse(BaseModel):
    platform: str
    current_version: str
    minimum_version: str
    is_update_required: bool
    update_url: str | None = None
