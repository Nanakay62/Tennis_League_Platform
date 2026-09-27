"""Unit tests for pure domain tournament brackets and draw generation."""

import pytest

from app.domain.brackets import (
    BracketPlayer,
    advance_bracket_winner,
    assign_seeds,
    build_consolation_draw,
    build_single_elimination_draw,
    generate_seed_order,
    next_power_of_two,
)


def make_player(idx: int, rank: int, wins: int, career_matches: int = 0) -> BracketPlayer:
    return BracketPlayer(
        player_id=f"p{idx}",
        display_name=f"Player {idx}",
        standings_rank=rank,
        regular_season_wins=wins,
        career_matches_played=career_matches,
    )


def test_next_power_of_two():
    assert next_power_of_two(2) == 4
    assert next_power_of_two(3) == 4
    assert next_power_of_two(4) == 4
    assert next_power_of_two(5) == 8
    assert next_power_of_two(8) == 8
    assert next_power_of_two(9) == 16
    assert next_power_of_two(16) == 16
    assert next_power_of_two(17) == 32


def test_seed_order_distribution():
    order_4 = generate_seed_order(4)
    assert order_4 == [1, 4, 2, 3]

    order_8 = generate_seed_order(8)
    assert order_8 == [1, 8, 4, 5, 2, 7, 3, 6]

    # Verify seed 1 and seed 2 are in opposing halves
    half = len(order_8) // 2
    assert (1 in order_8[:half] and 2 in order_8[half:]) or (
        2 in order_8[:half] and 1 in order_8[half:]
    )


def test_full_8_player_draw_structure_and_advancement():
    players = [
        make_player(1, rank=1, wins=6),
        make_player(2, rank=2, wins=5),
        make_player(3, rank=3, wins=5),
        make_player(4, rank=4, wins=4),
        make_player(5, rank=5, wins=4),
        make_player(6, rank=6, wins=3),
        make_player(7, rank=7, wins=3),
        make_player(8, rank=8, wins=2),
    ]

    draw = build_single_elimination_draw(players, enable_veteran_seeding=False)
    assert draw.bracket_size == 8
    assert draw.total_rounds == 3
    assert len(draw.rounds[1]) == 4  # Quarterfinals
    assert len(draw.rounds[2]) == 2  # Semifinals
    assert len(draw.rounds[3]) == 1  # Final

    # Verify no byes in full 8-player draw
    for m in draw.rounds[1]:
        assert not m.is_bye
        assert m.player1 is not None
        assert m.player2 is not None

    # Advance Round 1 winners
    # Match 1: Seed 1 vs Seed 8 -> Seed 1 wins
    advance_bracket_winner(draw, round_number=1, match_number=1, winner=players[0])
    # Semifinal 1 match should now have Player 1 as player1
    sf1 = draw.rounds[2][0]
    assert sf1.player1 == players[0]

    # Match 2: Seed 4 vs Seed 5 -> Seed 4 wins
    advance_bracket_winner(draw, round_number=1, match_number=2, winner=players[3])
    assert sf1.player2 == players[3]

    # Semifinal 1: Player 1 beats Player 4
    advance_bracket_winner(draw, round_number=2, match_number=1, winner=players[0])
    final = draw.rounds[3][0]
    assert final.player1 == players[0]


def test_draw_with_automatic_byes():
    # 5 players -> 8 bracket size, 3 byes
    players = [
        make_player(1, rank=1, wins=6),
        make_player(2, rank=2, wins=5),
        make_player(3, rank=3, wins=5),
        make_player(4, rank=4, wins=4),
        make_player(5, rank=5, wins=4),
    ]

    draw = build_single_elimination_draw(players, enable_veteran_seeding=False)
    assert draw.bracket_size == 8

    # Top seeds (1, 2, 3) should have received byes and auto-advanced to round 2
    r1_matches = draw.rounds[1]
    byes_count = sum(1 for m in r1_matches if m.is_bye)
    assert byes_count == 3

    # Check that Seed 1 auto-advanced to Semifinals (Round 2)
    sf1 = draw.rounds[2][0]
    assert sf1.player1 == players[0] or sf1.player2 == players[0]


def test_veteran_seeding_promotion():
    # 8 players; player 8 has 50 career matches played -> should be promoted over lower career players
    players = [
        make_player(1, rank=1, wins=6, career_matches=5),
        make_player(2, rank=2, wins=5, career_matches=8),
        make_player(3, rank=3, wins=5, career_matches=12),
        make_player(4, rank=4, wins=4, career_matches=2),
        make_player(5, rank=5, wins=4, career_matches=1),
        make_player(6, rank=6, wins=3, career_matches=4),
        make_player(7, rank=7, wins=3, career_matches=0),
        make_player(8, rank=8, wins=2, career_matches=50),  # Veteran
    ]

    seeded = assign_seeds(players, enable_veteran_seeding=True)
    # The last 25% (2 players of 8) are evaluated for veteran promotion
    # Player 8 should be seeded higher than Player 7
    p8_index = next(idx for idx, p in enumerate(seeded) if p.player_id == "p8")
    p7_index = next(idx for idx, p in enumerate(seeded) if p.player_id == "p7")
    assert p8_index < p7_index


def test_consolation_draw_generation():
    losers = [
        make_player(5, rank=5, wins=3),
        make_player(6, rank=6, wins=2),
        make_player(7, rank=7, wins=2),
        make_player(8, rank=8, wins=1),
    ]

    consolation = build_consolation_draw(losers)
    assert consolation is not None
    assert consolation.bracket_size == 4
    assert consolation.total_rounds == 2
    assert len(consolation.rounds[1]) == 2
    assert len(consolation.rounds[2]) == 1


def test_minimum_players_validation():
    with pytest.raises(ValueError, match="At least 2 players are required"):
        build_single_elimination_draw([make_player(1, rank=1, wins=5)])
