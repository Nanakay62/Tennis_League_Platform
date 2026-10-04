"""Pure domain partner matching, monthly reward evaluation, and Player of the Year (POTY) calculations.

Zero external framework or database dependencies.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CandidatePartner:
    player_id: str
    display_name: str
    rating: str | None
    home_area: str | None
    is_daytime: bool
    phone: str | None
    email: str | None
    matches_played_together: int = 0


def parse_rating(rating_str: str | None) -> float | None:
    """Parse string rating (e.g. '3.5', '3.0') to float."""
    if not rating_str:
        return None
    try:
        # Extract first decimal number
        cleaned = "".join(c for c in rating_str if c.isdigit() or c == ".")
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def filter_and_rank_partners(
    target_rating: str | None,
    target_home_area: str | None,
    target_is_daytime: bool,
    candidates: list[CandidatePartner],
    max_rating_diff: float = 0.5,
    limit: int = 20,
    strict_home_area: bool = True,
) -> list[CandidatePartner]:
    """Filter candidates within ±0.5 NTRP skill rating, scoring by proximity and schedule compatibility.

    Caps results to top candidates (default 20).
    When strict_home_area is True (default), strictly isolates matching pools (e.g. Accra vs Tema).
    """
    target_num = parse_rating(target_rating)

    scored_candidates: list[tuple[float, CandidatePartner]] = []

    for c in candidates:
        cand_num = parse_rating(c.rating)

        # NTRP rating filter (±0.5)
        if target_num is not None and cand_num is not None:
            diff = abs(target_num - cand_num)
            if diff > max_rating_diff + 0.01:
                continue
        else:
            diff = 0.0

        # Exact home area match check when strict_home_area is True (Accra vs Tema isolation)
        if (
            strict_home_area
            and target_home_area
            and c.home_area
            and target_home_area.strip().lower() != c.home_area.strip().lower()
        ):
            continue

        # Compatibility score (higher is better)
        score = 100.0 - (diff * 20.0)

        # Same home area bonus (when not strictly filtering or when areas match)
        if (
            target_home_area
            and c.home_area
            and target_home_area.strip().lower() == c.home_area.strip().lower()
        ):
            score += 25.0

        # Schedule compatibility bonus (both daytime or both evening)
        if target_is_daytime == c.is_daytime:
            score += 15.0

        # Diversity bonus: prioritize hitting with partners not yet played frequently
        score -= min(30.0, c.matches_played_together * 5.0)

        scored_candidates.append((score, c))

    # Sort descending by score
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored_candidates[:limit]]


def evaluate_monthly_partner_reward(
    distinct_partners_played: int,
    reward_threshold: int = 3,
) -> tuple[bool, int]:
    """Determine if a player qualifies for the free month reward credit.

    Handbook rule: Players who complete matches with 3+ distinct partners in a month
    receive a credit voucher towards their next season (e.g. 500 pesewas = GH₵ 5.00 discount).
    """
    qualifies = distinct_partners_played >= reward_threshold
    credit_cents = 500 if qualifies else 0
    return qualifies, credit_cents


@dataclass(frozen=True)
class PlayerMatchRecord:
    player_id: str
    display_name: str
    home_area: str | None
    rating: str | None
    matches_played: int
    matches_won: int
    distinct_opponents: int
    sportsmanship_points: int = 0


@dataclass(frozen=True)
class POTYScore:
    rank: int
    player_id: str
    display_name: str
    total_points: int
    matches_played: int
    matches_won: int
    distinct_opponents: int
    home_area: str | None


def compute_poty_leaderboard(
    records: list[PlayerMatchRecord],
) -> list[POTYScore]:
    """Calculate Player of the Year (POTY) leaderboard rankings.

    Formula:
    - 10 points per verified match played (Activity)
    - 5 bonus points per win (Performance)
    - 5 bonus points per distinct opponent played (Community engagement)
    - 1 point per sportsmanship vote
    """
    scores: list[tuple[int, PlayerMatchRecord]] = []

    for r in records:
        points = (
            (r.matches_played * 10)
            + (r.matches_won * 5)
            + (r.distinct_opponents * 5)
            + r.sportsmanship_points
        )
        scores.append((points, r))

    # Sort descending by points, tie-breaker: matches_won, then matches_played
    scores.sort(
        key=lambda item: (item[0], item[1].matches_won, item[1].matches_played), reverse=True
    )

    result: list[POTYScore] = []
    for rank, (pts, r) in enumerate(scores, start=1):
        result.append(
            POTYScore(
                rank=rank,
                player_id=r.player_id,
                display_name=r.display_name,
                total_points=pts,
                matches_played=r.matches_played,
                matches_won=r.matches_won,
                distinct_opponents=r.distinct_opponents,
                home_area=r.home_area,
            )
        )
    return result
