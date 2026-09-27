"""Pure domain module for league discipline, late cancellations, and strike policies.

No framework dependencies (no FastAPI, no SQLAlchemy).
All rules implemented as pure, testable functions per Handbook Chapter 2.2.
"""

from datetime import datetime, time


def evaluate_cancellation_strike(
    hours_before_match: float,
    match_time_local: datetime,
    is_rain_exempt: bool = False,
    late_cancel_hours_threshold: float = 4.0,
) -> int:
    """Evaluate strikes for late cancellation per Rule 8.

    - Cancelling within 4 hours: 1 strike.
    - Rain or unplayable weather: exempt (0 strikes).
    - Hours between 12:01 AM and 7:00 AM local time do not count toward the 4-hour window.
    """
    if is_rain_exempt:
        return 0

    # Overnight blackout check: 12:01 AM to 7:00 AM (00:01 to 07:00)
    match_time = match_time_local.time()
    if time(0, 1) <= match_time <= time(7, 0):
        # Match scheduled in the early morning blackout period
        return 0

    if hours_before_match < late_cancel_hours_threshold:
        return 1

    return 0


def evaluate_no_show_strike(
    minutes_waited: int,
    required_wait_minutes: int = 20,
) -> tuple[int, str | None]:
    """Evaluate strikes for a no-show per Rule 9.

    - Waiting player must wait at least 20 minutes before reporting a no-show.
    - If valid, records a 0-0 walkover win and 2 strikes (appealable to 1).
    """
    if minutes_waited < required_wait_minutes:
        return (
            0,
            f"You must wait at least {required_wait_minutes} minutes past match time before reporting a no-show (waited {minutes_waited} min).",
        )

    return (2, None)


def is_strike_limit_reached(total_confirmed_points: int, strike_limit: int = 3) -> bool:
    """Three-strike policy per Rule 10:
    3 strikes in a calendar year removes the player from the current season and next.
    """
    return total_confirmed_points >= strike_limit


def check_rematch_eligibility(
    prior_wins_vs_opponent: int,
    prior_losses_vs_opponent: int,
    season_days: int = 42,
    max_wins: int = 2,
    long_season_days: int = 63,
) -> tuple[bool, str | None]:
    """Rematch limits per Rule 4:
    - Up to 2 wins against the same opponent.
    - A 3rd match is allowed only if the first two matches were split (1-1).
    - A 3rd win is allowed in long seasons (63+ days).
    """
    total_played = prior_wins_vs_opponent + prior_losses_vs_opponent

    # Check long season exception
    is_long_season = season_days >= long_season_days
    allowed_max_wins = 3 if is_long_season else max_wins

    if prior_wins_vs_opponent >= allowed_max_wins:
        return (
            False,
            f"Maximum wins against this opponent reached ({prior_wins_vs_opponent} of {allowed_max_wins} allowed).",
        )

    # If already played twice: can only play 3rd match if split 1-1 (unless long season)
    if (
        total_played == 2
        and not is_long_season
        and (prior_wins_vs_opponent == 2 or prior_losses_vs_opponent == 2)
    ):
        return (
            False,
            "A third match is only permitted if the first two matches were split 1-1.",
        )

    return (True, None)
