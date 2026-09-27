"""Pure domain bracket generation, seeding, byes, and consolation draw engine.

Zero external framework or database dependencies.
"""

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class BracketPlayer:
    player_id: str
    display_name: str
    standings_rank: int
    regular_season_wins: int
    career_matches_played: int = 0
    is_veteran_seeded: bool = False


@dataclass
class DrawSeed:
    seed_number: int
    player: BracketPlayer | None  # None indicates a Bye


@dataclass
class DrawMatch:
    id: str
    round_number: int
    match_number: int  # 1-indexed within round
    player1: BracketPlayer | None = None
    player2: BracketPlayer | None = None
    winner: BracketPlayer | None = None
    is_bye: bool = False
    next_match_id: str | None = None
    loser_to_consolation: bool = False


@dataclass
class BracketDraw:
    bracket_size: int
    total_rounds: int
    rounds: dict[int, list[DrawMatch]] = field(default_factory=dict)
    seeds: list[DrawSeed] = field(default_factory=list)


def next_power_of_two(n: int) -> int:
    """Return smallest power of 2 >= n (minimum 4)."""
    if n <= 4:
        return 4
    return 1 << (n - 1).bit_length()


def assign_seeds(
    players: list[BracketPlayer],
    enable_veteran_seeding: bool = True,
) -> list[BracketPlayer]:
    """Assign seeds to players.

    By default, top 75% are seeded strictly by regular season standings rank,
    and 25% can be seeded by career matches played (veteran status).
    """
    if not players:
        return []

    # Sort primarily by rank
    by_rank = sorted(players, key=lambda p: (p.standings_rank, -p.regular_season_wins))
    total_players = len(by_rank)

    if not enable_veteran_seeding or total_players < 4:
        return by_rank

    num_veteran_seeds = max(1, total_players // 4)
    standard_seeds = by_rank[:-num_veteran_seeds]
    candidate_veterans = by_rank[-num_veteran_seeds:]

    # Sort remaining candidates by career matches played descending
    sorted_veterans = sorted(
        candidate_veterans,
        key=lambda p: (-p.career_matches_played, p.standings_rank),
    )

    # Mark veteran-seeded players
    result: list[BracketPlayer] = []
    result.extend(standard_seeds)
    for p in sorted_veterans:
        result.append(
            BracketPlayer(
                player_id=p.player_id,
                display_name=p.display_name,
                standings_rank=p.standings_rank,
                regular_season_wins=p.regular_season_wins,
                career_matches_played=p.career_matches_played,
                is_veteran_seeded=p.career_matches_played > 0,
            )
        )
    return result


def generate_seed_order(bracket_size: int) -> list[int]:
    """Generate standard tennis seed order pairings for round 1.

    E.g. for size 8: [1, 8, 4, 5, 3, 6, 2, 7]
    Produces matches: (1 vs 8), (4 vs 5), (3 vs 6), (2 vs 7).
    """
    if bracket_size <= 2:
        return [1, 2]

    order = [1, 2]
    while len(order) < bracket_size:
        next_order = []
        target_sum = len(order) * 2 + 1
        for seed in order:
            next_order.append(seed)
            next_order.append(target_sum - seed)
        order = next_order
    return order


def build_single_elimination_draw(
    players: list[BracketPlayer],
    enable_veteran_seeding: bool = True,
) -> BracketDraw:
    """Generate a single-elimination tournament draw with seeds and byes."""
    if len(players) < 2:
        raise ValueError("At least 2 players are required to generate a playoff draw.")

    ranked_players = assign_seeds(players, enable_veteran_seeding=enable_veteran_seeding)
    num_players = len(ranked_players)
    bracket_size = next_power_of_two(num_players)
    total_rounds = int(math.log2(bracket_size))

    seed_order = generate_seed_order(bracket_size)

    # Map seed numbers to players (top seeds get real players; byes go to highest seed numbers)
    seed_map: dict[int, BracketPlayer | None] = {}
    for i in range(1, bracket_size + 1):
        if i <= num_players:
            seed_map[i] = ranked_players[i - 1]
        else:
            seed_map[i] = None  # Bye

    seeds_list = [DrawSeed(seed_number=i, player=seed_map[i]) for i in range(1, bracket_size + 1)]

    # Initialize empty rounds
    rounds: dict[int, list[DrawMatch]] = {r: [] for r in range(1, total_rounds + 1)}

    # Build matches round by round from final backwards to link next_match_id
    matches_by_round_and_num: dict[tuple[int, int], DrawMatch] = {}

    for r in range(total_rounds, 0, -1):
        num_matches_in_round = 1 << (total_rounds - r)
        for m in range(1, num_matches_in_round + 1):
            match_id = f"R{r}M{m}"
            next_id = None
            if r < total_rounds:
                parent_match_num = (m + 1) // 2
                next_id = f"R{r + 1}M{parent_match_num}"

            dm = DrawMatch(
                id=match_id,
                round_number=r,
                match_number=m,
                next_match_id=next_id,
                loser_to_consolation=(r == 1),
            )
            rounds[r].append(dm)
            matches_by_round_and_num[(r, m)] = dm

    # Populate Round 1 matches using seed order
    round_1_matches = rounds[1]
    for idx, dm in enumerate(round_1_matches):
        p1_seed = seed_order[idx * 2]
        p2_seed = seed_order[idx * 2 + 1]

        p1 = seed_map.get(p1_seed)
        p2 = seed_map.get(p2_seed)

        dm.player1 = p1
        dm.player2 = p2

        # Automatic Bye advancement: if one player is None, other player automatically wins
        if p1 is not None and p2 is None:
            dm.winner = p1
            dm.is_bye = True
            # Advance to round 2
            parent_match_num = (dm.match_number + 1) // 2
            r2_match = matches_by_round_and_num[(2, parent_match_num)]
            if dm.match_number % 2 == 1:
                r2_match.player1 = p1
            else:
                r2_match.player2 = p1
        elif p2 is not None and p1 is None:
            dm.winner = p2
            dm.is_bye = True
            parent_match_num = (dm.match_number + 1) // 2
            r2_match = matches_by_round_and_num[(2, parent_match_num)]
            if dm.match_number % 2 == 1:
                r2_match.player1 = p2
            else:
                r2_match.player2 = p2

    return BracketDraw(
        bracket_size=bracket_size,
        total_rounds=total_rounds,
        rounds=rounds,
        seeds=seeds_list,
    )


def advance_bracket_winner(
    draw: BracketDraw,
    round_number: int,
    match_number: int,
    winner: BracketPlayer,
) -> BracketDraw:
    """Advance a winning player into the next round match."""
    current_match = draw.rounds[round_number][match_number - 1]
    current_match.winner = winner

    if current_match.next_match_id and round_number < draw.total_rounds:
        next_r = round_number + 1
        next_m_num = (match_number + 1) // 2
        next_match = draw.rounds[next_r][next_m_num - 1]

        if match_number % 2 == 1:
            next_match.player1 = winner
        else:
            next_match.player2 = winner

    return draw


def build_consolation_draw(first_round_losers: list[BracketPlayer]) -> BracketDraw | None:
    """Generate a consolation draw for players eliminated in the opening round."""
    if len(first_round_losers) < 2:
        return None
    return build_single_elimination_draw(first_round_losers, enable_veteran_seeding=False)
