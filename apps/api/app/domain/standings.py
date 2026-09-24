"""Pure domain module for division standings, tie-breaker sorting, and playoff eligibility.

No framework dependencies (no FastAPI, no SQLAlchemy).
"""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass
class StandingRow:
    player_id: str
    player_name: str
    home_area: str = ""
    is_daytime: bool = False  # (d) flag
    wins: int = 0
    losses: int = 0
    games_won: int = 0
    games_lost: int = 0
    distinct_opponents: int = 0
    is_new_player: bool = False
    rank: int = 0
    is_playoff_eligible: bool = False
    playoff_indicator: str = ""

    @property
    def matches_played(self) -> int:
        return self.wins + self.losses

    @property
    def win_differential(self) -> int:
        return self.wins - self.losses

    @property
    def games_pct(self) -> float:
        total_games = self.games_won + self.games_lost
        if total_games == 0:
            return 0.0
        return round(self.games_won / total_games, 3)

    @property
    def games_pct_display(self) -> str:
        """Format matching reference: 0.577 (105-77)."""
        pct_str = f"{self.games_pct:.3f}"
        return f"{pct_str} ({self.games_won}-{self.games_lost})"


@dataclass(frozen=True)
class DivisionRules:
    playoff_min_wins: int = 5
    new_player_min_matches: int = 6


def calculate_eligibility(row: StandingRow, rules: DivisionRules) -> bool:
    """Determine playoff eligibility per handbook rule 10."""
    if row.is_new_player and row.distinct_opponents < rules.new_player_min_matches:
        return False
    return row.wins >= rules.playoff_min_wins


def sort_key(row: StandingRow) -> tuple[int, int, float]:
    """Standings sorting hierarchy:
    1. Wins minus losses (descending)
    2. Matches played (descending)
    3. Games-won percentage (descending)
    """
    return (-row.win_differential, -row.matches_played, -row.games_pct)


DEFAULT_DIVISION_RULES = DivisionRules()


def compute_standings(
    rows: list[StandingRow],
    rules: DivisionRules = DEFAULT_DIVISION_RULES,
    head_to_head: Mapping[tuple[str, str], int] | None = None,
) -> list[StandingRow]:
    """Sort standing rows and assign ranks and playoff eligibility."""
    sorted_rows = sorted(rows, key=sort_key)

    # Apply head-to-head tie breaker for tie at #1 if exactly two players are tied on record and matches
    if head_to_head and len(sorted_rows) >= 2:
        first, second = sorted_rows[0], sorted_rows[1]
        if (
            first.win_differential == second.win_differential
            and first.matches_played == second.matches_played
        ):
            # Check head to head
            h2h_first_vs_second = head_to_head.get((first.player_id, second.player_id), 0)
            h2h_second_vs_first = head_to_head.get((second.player_id, first.player_id), 0)
            if h2h_second_vs_first > h2h_first_vs_second:
                # Swap first and second
                sorted_rows[0], sorted_rows[1] = second, first

    # Assign ranks and calculate playoff status
    for i, row in enumerate(sorted_rows, start=1):
        row.rank = i
        row.is_playoff_eligible = calculate_eligibility(row, rules)
        # Indicator: games above .500 (+/-) or status
        diff = row.win_differential
        row.playoff_indicator = f"+{diff}" if diff > 0 else str(diff)

    return sorted_rows
