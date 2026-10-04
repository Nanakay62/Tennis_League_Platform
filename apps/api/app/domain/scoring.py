"""Pure domain module for tennis match scoring and format validation.

No framework dependencies (no FastAPI, no SQLAlchemy).
All rules operate as pure functions with unit and property tests.
"""

from dataclasses import dataclass
from enum import StrEnum


class MatchFormat(StrEnum):
    BEST_OF_THREE = "best_of_three"  # 6-game sets, 7-pt tiebreak at 6-6
    MATCH_TIEBREAK = "match_tiebreak"  # 2 sets + 10-pt match tiebreak
    PRO_SET_10 = "pro_set_10"  # first to 10 games, tiebreak at 9-9
    FAST4 = "fast4"  # sets to 4, tiebreak at 3-3, no-ad


class OutcomeType(StrEnum):
    PLAYED = "played"
    RETIRED = "retired"
    NO_SHOW = "no_show"
    LATE_CANCEL = "late_cancel"


# format -> (games to win a set, tiebreak played at n-n, sets needed to win)
FORMAT_RULES: dict[MatchFormat, tuple[int, int, int]] = {
    MatchFormat.BEST_OF_THREE: (6, 6, 2),
    MatchFormat.MATCH_TIEBREAK: (6, 6, 2),
    MatchFormat.PRO_SET_10: (10, 9, 1),
    MatchFormat.FAST4: (4, 3, 2),
}


@dataclass(frozen=True)
class SetScore:
    winner: int  # games/points won by the reported match winner
    loser: int  # games/points won by the reported match loser
    super_tiebreak: bool = False


def set_is_complete(s: SetScore, fmt: MatchFormat) -> bool:
    """Check if an individual set is completed according to match format rules."""
    hi, lo = max(s.winner, s.loser), min(s.winner, s.loser)
    if s.super_tiebreak:
        return hi >= 10 and hi - lo >= 2

    games, tb_at, _ = FORMAT_RULES[fmt]
    if games == tb_at:  # standard set (6-0..6-4, 7-5, 7-6)
        return (hi == games and lo <= games - 2) or (hi == games + 1 and lo in (games - 1, games))
    return (
        hi == games and lo <= tb_at
    )  # Fast4 (4-0..4-2, 5-3, 5-4) / pro set (10-0..10-8, 11-9, 11-10)


def validate_result(
    sets: list[SetScore],
    fmt: MatchFormat,
    outcome: OutcomeType = OutcomeType.PLAYED,
) -> list[str]:
    """Validate a reported match result.

    Returns a list of human-readable error messages. An empty list indicates valid scores.
    """
    errors: list[str] = []

    # No-show and late cancellations are recorded as 0-0 walkover wins
    if outcome in (OutcomeType.NO_SHOW, OutcomeType.LATE_CANCEL):
        if sets and not (len(sets) == 1 and sets[0].winner == 0 and sets[0].loser == 0):
            errors.append(
                f"{outcome.replace('_', ' ').capitalize()} must have a 0-0 walkover score."
            )
        return errors

    if not sets:
        return ["At least one set score is required."]

    is_retired = outcome == OutcomeType.RETIRED
    _, _, sets_needed = FORMAT_RULES[fmt]

    for i, s in enumerate(sets, start=1):
        if s.winner < 0 or s.loser < 0:
            errors.append(f"Set {i}: negative game counts are invalid.")
            continue

        if s.super_tiebreak and not (fmt is MatchFormat.MATCH_TIEBREAK and i == 3):
            errors.append(
                f"Set {i}: super tiebreak is only valid as the 3rd set in a Match Tiebreak format."
            )

        is_last = i == len(sets)
        if not set_is_complete(s, fmt) and not (is_retired and is_last):
            errors.append(f"Set {i}: {s.winner}-{s.loser} is not a valid finished set.")

    if is_retired:
        # In a retirement, at least one completed set is required unless league policy allows earlier
        if len(sets) < 1:
            errors.append("At least one set must be reported for a retirement.")
        return errors

    won = sum(1 for s in sets if s.winner > s.loser)
    lost = len(sets) - won

    if won != sets_needed or lost >= sets_needed:
        errors.append(
            f"Reported winner did not win the required {sets_needed} sets (won {won}, lost {lost})."
        )

    return errors


@dataclass(frozen=True)
class HandicapHeadStart:
    lead: str  # "15-0" or "30-0"
    court: str  # "Ad court" or "Deuce court"
    lower_rated_player_id: str
    rating_gap: float
    tiebreak_rule: str = "7-point tiebreak at 6-6 (starts 0-0)"


def calculate_handicap_headstart(
    player_a_id: str,
    player_a_rating: float | None,
    player_b_id: str,
    player_b_rating: float | None,
) -> HandicapHeadStart | None:
    """Calculate the starting point lead and serve court based on rating gap.

    Gap <= 0.5: no handicap (returns None).
    Gap > 0.5 and < 1.0: 15-0 lead, serve starts on Ad court.
    Gap >= 1.0: 30-0 lead, serve starts on Deuce court.
    """
    if player_a_rating is None or player_b_rating is None:
        return None

    gap = round(abs(player_a_rating - player_b_rating), 2)
    if gap <= 0.5:
        return None

    lower_id = player_a_id if player_a_rating < player_b_rating else player_b_id
    if gap >= 1.0:
        return HandicapHeadStart(
            lead="30-0",
            court="Deuce court",
            lower_rated_player_id=lower_id,
            rating_gap=gap,
        )

    return HandicapHeadStart(
        lead="15-0",
        court="Ad court",
        lower_rated_player_id=lower_id,
        rating_gap=gap,
    )


def evaluate_handicap_eligibility(
    player_a_id: str,
    player_a_rating: float | None,
    player_a_matches: int,
    player_b_id: str,
    player_b_rating: float | None,
    player_b_matches: int,
    min_qualifying_matches: int = 6,
) -> tuple[bool, str | None, HandicapHeadStart | None]:
    """Validate whether two players are eligible for Handicap Scoring.

    1. Both players must have an assigned rating.
    2. Both players must have at least min_qualifying_matches on this platform.
    3. Rating difference must exceed 0.5.
    Returns:
        (True, None, head_start) if eligible.
        (False, reason, None) if ineligible.
    """
    if player_a_rating is None or player_b_rating is None:
        return (
            False,
            "Both players must have an assigned rating to qualify for Handicap Scoring (rating not available).",
            None,
        )

    if player_a_matches < min_qualifying_matches or player_b_matches < min_qualifying_matches:
        return (
            False,
            f"Both players must have played at least {min_qualifying_matches} confirmed matches on this platform to qualify for Handicap Scoring.",
            None,
        )

    gap = round(abs(player_a_rating - player_b_rating), 2)
    if gap <= 0.5:
        return (
            False,
            f"Rating difference must be greater than 0.5 to qualify for Handicap Scoring (current gap: {gap:.2f}).",
            None,
        )

    head_start = calculate_handicap_headstart(
        player_a_id, player_a_rating, player_b_id, player_b_rating
    )
    return True, None, head_start
