from app.domain.standings import DivisionRules, StandingRow, compute_standings


def test_standings_sort_by_differential():
    player_a = StandingRow(
        player_id="1", player_name="Player A", wins=5, losses=1, games_won=36, games_lost=15
    )
    player_b = StandingRow(
        player_id="2", player_name="Player B", wins=3, losses=0, games_won=18, games_lost=5
    )
    player_c = StandingRow(
        player_id="3", player_name="Player C", wins=2, losses=4, games_won=20, games_lost=30
    )

    standings = compute_standings([player_b, player_c, player_a])

    # Player A has diff +4 (5-1), Player B has diff +3 (3-0), Player C has diff -2 (2-4)
    assert standings[0].player_id == "1"
    assert standings[0].rank == 1
    assert standings[0].playoff_indicator == "+4"
    assert standings[1].player_id == "2"
    assert standings[1].rank == 2
    assert standings[2].player_id == "3"
    assert standings[2].rank == 3


def test_standings_display_games_percentage():
    player = StandingRow(
        player_id="1", player_name="Player A", wins=8, losses=2, games_won=105, games_lost=77
    )
    # 105 / (105 + 77) = 105 / 182 = 0.57692... rounded to 0.577
    assert player.games_pct == 0.577
    assert player.games_pct_display == "0.577 (105-77)"


def test_playoff_eligibility():
    rules = DivisionRules(playoff_min_wins=5, new_player_min_matches=6)

    # Veteran with 5 wins
    row_vet = StandingRow(
        player_id="1", player_name="Veteran", wins=5, losses=2, is_new_player=False
    )
    # New player with 5 wins but only 4 distinct opponents
    row_new_short = StandingRow(
        player_id="2",
        player_name="New Short",
        wins=5,
        losses=0,
        distinct_opponents=4,
        is_new_player=True,
    )
    # New player with 5 wins and 6 distinct opponents
    row_new_eligible = StandingRow(
        player_id="3",
        player_name="New Eligible",
        wins=5,
        losses=1,
        distinct_opponents=6,
        is_new_player=True,
    )

    standings = compute_standings([row_vet, row_new_short, row_new_eligible], rules=rules)
    by_id = {r.player_id: r for r in standings}

    assert by_id["1"].is_playoff_eligible is True
    assert by_id["2"].is_playoff_eligible is False
    assert by_id["3"].is_playoff_eligible is True
