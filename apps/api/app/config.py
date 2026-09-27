"""Application configuration and configurable league policies."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Market Defaults
    DEFAULT_MARKET_NAME: str = "Frankfurt"
    DEFAULT_MARKET_TIMEZONE: str = "Europe/Berlin"
    DEFAULT_MARKET_CURRENCY: str = "EUR"

    # Persistence
    DATABASE_URL: str = "postgresql+psycopg://league:league@localhost:5432/league"
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"

    # Auth & Tokens
    SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-min-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Stripe (Test Mode)
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_placeholder"

    # CORS & Client
    CORS_ORIGINS: list[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
    ]

    # Push Notifications & Email
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"
    EMAIL_PROVIDER: str = "console"  # console, resend, ses
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Frankfurt Flex League <noreply@frankfurttennis.de>"

    # Background Jobs & Backups
    PROCRASTINATE_USE_IN_MEMORY: bool = False
    BACKUP_R2_ENDPOINT_URL: str = ""
    BACKUP_R2_BUCKET: str = "tennis-league-backups"
    BACKUP_R2_ACCESS_KEY_ID: str = ""
    BACKUP_R2_SECRET_ACCESS_KEY: str = ""
    BACKUP_ENCRYPTION_KEY: str = "dev-backup-encryption-key-32-chars-long!"

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
