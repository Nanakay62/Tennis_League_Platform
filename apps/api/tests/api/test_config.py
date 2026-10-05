"""Tests for application settings validation and security assertions."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_development_defaults():
    settings = Settings(ENVIRONMENT="development", DEBUG=False)
    assert settings.ENVIRONMENT == "development"
    assert settings.DEBUG is False
    assert settings.DEFAULT_MARKET_NAME == "Accra"
    assert settings.DEFAULT_MARKET_TIMEZONE == "Africa/Accra"
    assert settings.DEFAULT_MARKET_CURRENCY == "GHS"


def test_settings_production_requires_debug_false():
    with pytest.raises(ValidationError, match="DEBUG must be False in production"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=True,
            SECRET_KEY="secure-production-key-with-over-32-chars-long!",
        )


def test_settings_production_requires_secure_secret_key():
    with pytest.raises(
        ValidationError, match="SECRET_KEY must be a cryptographically secure random string"
    ):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="dev-insecure-secret-key-too-short",
        )


def test_settings_production_valid():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a" * 32,
        PAYSTACK_SECRET_KEY="sk_live_real_paystack_secret",
        STRIPE_WEBHOOK_SECRET="whsec_real_stripe_webhook_secret",
    )
    assert settings.ENVIRONMENT == "production"
    assert settings.DEBUG is False
    assert len(settings.SECRET_KEY) == 32


def test_settings_production_rejects_placeholder_secrets():
    with pytest.raises(ValidationError, match="PAYSTACK_SECRET_KEY cannot be a placeholder"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="a" * 32,
            PAYSTACK_SECRET_KEY="sk_test_paystack_placeholder",
            STRIPE_WEBHOOK_SECRET="whsec_real_secret",
        )

    with pytest.raises(ValidationError, match="STRIPE_WEBHOOK_SECRET cannot be a placeholder"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="a" * 32,
            PAYSTACK_SECRET_KEY="sk_live_real_secret",
            STRIPE_WEBHOOK_SECRET="whsec_placeholder",
        )


def test_cors_origins_empty_string_fallback():
    settings = Settings(CORS_ORIGINS="")
    assert len(settings.CORS_ORIGINS) > 0
    assert "http://localhost:3000" in settings.CORS_ORIGINS


def test_cors_origins_comma_separated():
    settings = Settings(CORS_ORIGINS="https://frontend.vercel.app, https://custom.domain.com")
    assert settings.CORS_ORIGINS == ["https://frontend.vercel.app", "https://custom.domain.com"]


def test_cors_origins_json_array():
    settings = Settings(CORS_ORIGINS='["https://frontend.vercel.app", "https://custom.domain.com"]')
    assert settings.CORS_ORIGINS == ["https://frontend.vercel.app", "https://custom.domain.com"]


def test_no_legacy_ids_or_frankfurt_content():
    apps_dir = Path(__file__).resolve().parents[3]
    banned = ["div-comp-1", "div-skilled-1", "Sachsenhausen", "Frankfurt", "frankfurt"]
    hits = [
        (str(p), b)
        for p in apps_dir.rglob("*")
        if p.is_file()
        and p.suffix in {".py", ".ts", ".tsx", ".md"}
        and ".venv" not in p.parts
        and "node_modules" not in p.parts
        and ".hypothesis" not in p.parts
        and p.name != Path(__file__).name
        for b in banned
        if b in p.read_text(errors="ignore")
    ]
    assert hits == []
