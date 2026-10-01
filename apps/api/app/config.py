"""Application configuration and configurable league policies."""

import contextlib
import json
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False  # Must remain False in production — enables stack trace leakage if True

    # Market Defaults
    DEFAULT_MARKET_NAME: str = "Accra"
    DEFAULT_MARKET_TIMEZONE: str = "Africa/Accra"
    DEFAULT_MARKET_CURRENCY: str = "GHS"

    # Persistence
    DATABASE_URL: str = "postgresql+psycopg://league:league@localhost:5432/league"
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"

    # Auth & Tokens
    SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-min-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Stripe (Legacy / International)
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_placeholder"

    # Paystack (Ghana Mobile Money & Cards)
    PAYSTACK_SECRET_KEY: str = "sk_test_paystack_placeholder"
    PAYSTACK_PUBLIC_KEY: str = "pk_test_paystack_placeholder"
    PAYSTACK_API_BASE_URL: str = "https://api.paystack.co"

    # CORS & Client
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "https://tennis-league-platform.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: list[str] | str) -> list[str]:
        default_origins = [
            "http://localhost:8081",
            "http://localhost:19006",
            "http://localhost:3000",
            "http://127.0.0.1:8081",
            "https://tennis-league-platform.vercel.app",
        ]
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return default_origins
            if v.startswith("[") and v.endswith("]"):
                with contextlib.suppress(json.JSONDecodeError, TypeError, ValueError):
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
            origins = [x.strip() for x in v.split(",") if x.strip()]
            return origins if origins else default_origins
        elif isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()] or default_origins
        return default_origins

    # Push Notifications & Email
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"
    EMAIL_PROVIDER: str = "console"  # console, resend, ses
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Accra Flex League <noreply@accratennis.com>"

    # Logging & Observability
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: str = ""

    # Background Jobs & Backups
    PROCRASTINATE_USE_IN_MEMORY: bool = False
    BACKUP_R2_ENDPOINT_URL: str = ""
    BACKUP_R2_BUCKET: str = "tennis-league-backups"
    BACKUP_R2_ACCESS_KEY_ID: str = ""
    BACKUP_ENCRYPTION_KEY: str = "dev-backup-encryption-key-32-chars-long!"

    # Avatar Storage (Cloudflare R2)
    AVATAR_R2_BUCKET: str = "tennis-league-avatars"
    AVATAR_R2_ENDPOINT_URL: str = ""
    AVATAR_R2_ACCESS_KEY_ID: str = ""
    AVATAR_R2_SECRET_ACCESS_KEY: str = ""
    AVATAR_PUBLIC_BASE_URL: str = ""

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Strict production assertions ensuring no insecure keys or debug mode in production."""
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production.")
            if "insecure" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be a cryptographically secure random string with at least 32 characters in production."
                )
        return self

    # Configurable League Rules (from Handbook Chapter 2.2)
    min_completed_sets: int = 1
    max_wins_vs_opponent: int = 2
    long_season_days: int = 63
    playoff_min_wins: int = 5
    playoff_women_min_wins: int = 4
    new_player_min_matches: int = 6
    late_cancel_hours: int = 4
    no_show_wait_minutes: int = 20
    no_show_strikes: int = 2
    strike_limit: int = 3
    round_deadline_days: int = 10
    refund_window_days: int = 7
    min_partners_guaranteed: int = 6
    review_game_margin: int = 8
    partner_free_month_min: int = 3
    auto_confirm_match_hours: int = 48
    dispute_cooling_off_hours: int = 24
    inactive_nudge_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
