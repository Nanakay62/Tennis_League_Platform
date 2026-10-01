"""Tests for application settings validation and security assertions."""

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
    )
    assert settings.ENVIRONMENT == "production"
    assert settings.DEBUG is False
    assert len(settings.SECRET_KEY) == 32


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
