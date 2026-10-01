"""Unit tests for pure domain background jobs and notifications logic."""

from datetime import UTC, datetime, timedelta

from app.domain.jobs import (
    format_auto_confirm_notification,
    format_backup_filename,
    format_inactive_nudge,
    format_kickoff_notification,
    is_match_auto_confirmable,
    is_player_inactive,
    validate_expo_push_token,
)


def test_is_match_auto_confirmable():
    base_time = datetime(2026, 9, 20, 12, 0, 0, tzinfo=UTC)

    # Submitted exactly 48 hours ago
    current_time_48h = base_time + timedelta(hours=48)
    assert (
        is_match_auto_confirmable("submitted", base_time, current_time_48h, auto_confirm_hours=48)
        is True
    )

    # Submitted 47h 59m ago (not yet 48h)
    current_time_almost = base_time + timedelta(hours=47, minutes=59)
    assert (
        is_match_auto_confirmable(
            "submitted", base_time, current_time_almost, auto_confirm_hours=48
        )
        is False
    )

    # Already confirmed or disputed should never auto-confirm
    assert (
        is_match_auto_confirmable("confirmed", base_time, current_time_48h, auto_confirm_hours=48)
        is False
    )
    assert (
        is_match_auto_confirmable("disputed", base_time, current_time_48h, auto_confirm_hours=48)
        is False
    )

    # Custom hours parameter
    assert (
        is_match_auto_confirmable(
            "submitted", base_time, base_time + timedelta(hours=24), auto_confirm_hours=24
        )
        is True
    )


def test_is_player_inactive():
    season_start = datetime(2026, 9, 1, 0, 0, 0, tzinfo=UTC)

    # Player with last activity 6 days ago -> Active
    last_act_6d = datetime(2026, 9, 10, 10, 0, 0, tzinfo=UTC)
    check_time_6d = last_act_6d + timedelta(days=6)
    assert (
        is_player_inactive(last_act_6d, season_start, check_time_6d, inactive_threshold_days=7)
        is False
    )

    # Player with last activity 8 days ago -> Inactive
    check_time_8d = last_act_6d + timedelta(days=8)
    assert (
        is_player_inactive(last_act_6d, season_start, check_time_8d, inactive_threshold_days=7)
        is True
    )

    # Player with no matches played since season start 10 days ago -> Inactive
    check_time_from_start = season_start + timedelta(days=10)
    assert (
        is_player_inactive(None, season_start, check_time_from_start, inactive_threshold_days=7)
        is True
    )


def test_validate_expo_push_token():
    assert validate_expo_push_token("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]") is True
    assert validate_expo_push_token("ExpoPushToken[12345-abcde_XYZ]") is True
    assert validate_expo_push_token("ExponentPushToken[abc-123_456]") is True

    assert validate_expo_push_token("") is False
    assert validate_expo_push_token("invalid_token_123") is False
    assert validate_expo_push_token("ExponentPushToken[]") is False
    assert validate_expo_push_token("ExponentPushToken[has space]") is False


def test_format_kickoff_notification():
    opponents = [
        {
            "name": "Max Mustermann",
            "phone": "+49170123456",
            "email": "max@example.com",
            "rating": "3.5",
        },
        {
            "name": "Lukas Schmidt",
            "phone": "+49170654321",
            "email": "lukas@example.com",
            "rating": "4.0",
        },
    ]
    payload = format_kickoff_notification(
        division_name="3.5 Competitive Men",
        program_title="Fall 2026 Season",
        player_name="Thomas Müller",
        opponents=opponents,
    )
    assert "3.5 Competitive Men" in payload["push_title"]
    assert "Thomas Müller" in payload["push_body"]
    assert "2 players" in payload["push_body"]
    assert "Max Mustermann" in payload["email_body"]
    assert "+49170123456" in payload["email_body"]
    assert "Lukas Schmidt" in payload["email_body"]


def test_format_inactive_nudge():
    payload = format_inactive_nudge(
        player_name="Anna Becker",
        division_name="3.0 Women",
        days_inactive=9,
    )
    assert "Anna Becker" in payload["push_body"]
    assert "9 days" in payload["push_body"]
    assert "3.0 Women" in payload["email_subject"]
    assert "book a court" in payload["push_body"]
    assert "Accra court" in payload["email_body"]


def test_format_auto_confirm_notification():
    payload = format_auto_confirm_notification(
        winner_name="Stefan Huber",
        loser_name="Jan Novak",
        score_summary="6-4, 7-5",
    )
    assert "Stefan Huber def. Jan Novak" in payload["push_body"]
    assert "6-4, 7-5" in payload["push_body"]
    assert "48-hour dispute window" in payload["email_body"]


def test_format_backup_filename():
    ts = datetime(2026, 9, 27, 3, 0, 0, tzinfo=UTC)
    filename = format_backup_filename("accra", ts)
    assert filename == "backup_accra_20260927_030000.sql.gz.enc"

    # Test sanitization with special chars
    filename_dirty = format_backup_filename("Accra & Tema / Greater Accra", ts)
    assert filename_dirty.startswith("backup_accra___tema___greater_accra_")
    assert filename_dirty.endswith(".sql.gz.enc")
