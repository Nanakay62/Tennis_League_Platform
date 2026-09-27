"""Unit tests for league discipline, late cancellation strikes, no-show waiting rules, and rematches."""

from datetime import UTC, datetime

from app.domain.discipline import (
    check_rematch_eligibility,
    evaluate_cancellation_strike,
    evaluate_no_show_strike,
    is_strike_limit_reached,
)


def test_late_cancellation_strikes():
    match_time = datetime(2026, 10, 5, 18, 0, tzinfo=UTC)

    # 3 hours before match (inside 4h window) -> 1 strike
    assert evaluate_cancellation_strike(hours_before_match=3.0, match_time_local=match_time) == 1

    # 5 hours before match (outside 4h window) -> 0 strikes
    assert evaluate_cancellation_strike(hours_before_match=5.0, match_time_local=match_time) == 0

    # Inside window but rain exempt -> 0 strikes
    assert (
        evaluate_cancellation_strike(
            hours_before_match=2.0, match_time_local=match_time, is_rain_exempt=True
        )
        == 0
    )


def test_overnight_cancellation_blackout_period():
    # Match scheduled at 6:30 AM (between 00:01 and 07:00) -> exempt from late cancel penalty
    early_match = datetime(2026, 10, 5, 6, 30, tzinfo=UTC)
    assert evaluate_cancellation_strike(hours_before_match=2.0, match_time_local=early_match) == 0


def test_no_show_wait_period():
    # Only waited 15 minutes -> rejected
    strikes, err = evaluate_no_show_strike(minutes_waited=15)
    assert strikes == 0
    assert err is not None
    assert "at least 20 minutes" in err

    # Waited 22 minutes -> 2 strikes awarded
    strikes, err = evaluate_no_show_strike(minutes_waited=22)
    assert strikes == 2
    assert err is None


def test_three_strike_limit():
    assert is_strike_limit_reached(2) is False
    assert is_strike_limit_reached(3) is True
    assert is_strike_limit_reached(4) is True


def test_rematch_limits_standard_and_long_seasons():
    # Standard season (42 days):
    # 0 wins, 0 losses -> allowed
    allowed, _ = check_rematch_eligibility(0, 0)
    assert allowed is True

    # 1 win, 0 losses -> allowed
    allowed, _ = check_rematch_eligibility(1, 0)
    assert allowed is True

    # 2 wins, 0 losses -> 3rd match NOT allowed in normal season
    allowed, err = check_rematch_eligibility(2, 0, season_days=42)
    assert allowed is False
    assert "Maximum wins" in err

    # 1 win, 1 loss (split) -> 3rd match IS allowed in normal season
    allowed, _ = check_rematch_eligibility(1, 1, season_days=42)
    assert allowed is True

    # Long season exception (63+ days): 3rd win allowed even if 2-0
    allowed, _ = check_rematch_eligibility(2, 0, season_days=63)
    assert allowed is True

    # 3 wins in long season -> 4th match NOT allowed
    allowed, err = check_rematch_eligibility(3, 0, season_days=63)
    assert allowed is False
