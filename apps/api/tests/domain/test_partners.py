"""Unit tests for pure domain partner matching, rewards, and POTY leaderboard."""

from app.domain.partners import (
    CandidatePartner,
    PlayerMatchRecord,
    compute_poty_leaderboard,
    evaluate_monthly_partner_reward,
    filter_and_rank_partners,
    parse_rating,
)


def test_parse_rating():
    assert parse_rating("3.5") == 3.5
    assert parse_rating("3.0") == 3.0
    assert parse_rating("4.0+") == 4.0
    assert parse_rating("NTRP 2.5") == 2.5
    assert parse_rating(None) is None
    assert parse_rating("unrated") is None


def test_filter_and_rank_partners_rating_band():
    candidates = [
        CandidatePartner(
            player_id="p1",
            display_name="Player 3.0",
            rating="3.0",
            home_area="Tema",
            is_daytime=True,
            phone="+233241111111",
            email="p1@example.com",
        ),
        CandidatePartner(
            player_id="p2",
            display_name="Player 3.5 Same Area",
            rating="3.5",
            home_area="Accra",
            is_daytime=False,
            phone="+233242222222",
            email="p2@example.com",
        ),
        CandidatePartner(
            player_id="p3",
            display_name="Player 4.0",
            rating="4.0",
            home_area="Tema",
            is_daytime=True,
            phone="+233243333333",
            email="p3@example.com",
        ),
        CandidatePartner(
            player_id="p4",
            display_name="Player 5.0 Outside Band",
            rating="5.0",
            home_area="Accra",
            is_daytime=False,
            phone="+233244444444",
            email="p4@example.com",
        ),
    ]

    # Target is 3.5 in Accra (testing rating band ranking without strict area isolation)
    matches = filter_and_rank_partners(
        target_rating="3.5",
        target_home_area="Accra",
        target_is_daytime=False,
        candidates=candidates,
        max_rating_diff=0.5,
        strict_home_area=False,
    )

    # Player 4 (5.0) should be excluded
    matched_ids = [m.player_id for m in matches]
    assert "p4" not in matched_ids
    assert "p1" in matched_ids
    assert "p2" in matched_ids
    assert "p3" in matched_ids

    # Player 2 should be ranked top because same rating (3.5), same area (Accra), same availability (False)
    assert matches[0].player_id == "p2"


def test_filter_and_rank_partners_strict_home_area():
    candidates = [
        CandidatePartner(
            player_id="p1",
            display_name="Accra Player",
            rating="3.5",
            home_area="Accra",
            is_daytime=True,
            phone="0241",
            email="p1@example.com",
        ),
        CandidatePartner(
            player_id="p2",
            display_name="Tema Player",
            rating="3.5",
            home_area="Tema",
            is_daytime=True,
            phone="0242",
            email="p2@example.com",
        ),
    ]

    # Target in Accra with strict_home_area=True (default)
    matches = filter_and_rank_partners(
        target_rating="3.5",
        target_home_area="Accra",
        target_is_daytime=True,
        candidates=candidates,
    )

    assert len(matches) == 1
    assert matches[0].player_id == "p1"


def test_evaluate_monthly_partner_reward():
    assert evaluate_monthly_partner_reward(1) == (False, 0)
    assert evaluate_monthly_partner_reward(2) == (False, 0)
    assert evaluate_monthly_partner_reward(3) == (True, 500)
    assert evaluate_monthly_partner_reward(5) == (True, 500)


def test_compute_poty_leaderboard():
    records = [
        PlayerMatchRecord(
            player_id="p1",
            display_name="High Win Player",
            home_area="Accra",
            rating="3.5",
            matches_played=10,
            matches_won=8,
            distinct_opponents=7,
            sportsmanship_points=3,
        ),
        PlayerMatchRecord(
            player_id="p2",
            display_name="High Activity Player",
            home_area="Tema",
            rating="3.0",
            matches_played=15,
            matches_won=5,
            distinct_opponents=10,
            sportsmanship_points=5,
        ),
    ]

    leaderboard = compute_poty_leaderboard(records)
    assert len(leaderboard) == 2

    # Player 2 points: 15*10 (150) + 5*5 (25) + 10*5 (50) + 5 = 230
    # Player 1 points: 10*10 (100) + 8*5 (40) + 7*5 (35) + 3 = 178
    assert leaderboard[0].player_id == "p2"
    assert leaderboard[0].total_points == 230
    assert leaderboard[0].rank == 1

    assert leaderboard[1].player_id == "p1"
    assert leaderboard[1].total_points == 178
    assert leaderboard[1].rank == 2
