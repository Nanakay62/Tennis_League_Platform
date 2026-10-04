from app.domain.scoring import MatchFormat, OutcomeType, SetScore, validate_result


def test_valid_best_of_three_two_straight_sets():
    sets = [SetScore(winner=6, loser=3), SetScore(winner=6, loser=4)]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE)
    assert errors == []


def test_valid_best_of_three_three_sets():
    sets = [
        SetScore(winner=6, loser=4),
        SetScore(winner=4, loser=6),
        SetScore(winner=7, loser=5),
    ]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE)
    assert errors == []


def test_valid_match_tiebreak_format():
    # 2 standard sets + 10-point super tiebreak
    sets = [
        SetScore(winner=6, loser=2),
        SetScore(winner=3, loser=6),
        SetScore(winner=10, loser=8, super_tiebreak=True),
    ]
    errors = validate_result(sets, MatchFormat.MATCH_TIEBREAK)
    assert errors == []


def test_super_tiebreak_invalid_in_set_one():
    sets = [
        SetScore(winner=10, loser=8, super_tiebreak=True),
        SetScore(winner=6, loser=2),
    ]
    errors = validate_result(sets, MatchFormat.MATCH_TIEBREAK)
    assert any("super tiebreak is only valid as the 3rd set" in e for e in errors)


def test_valid_10_game_pro_set():
    sets = [SetScore(winner=10, loser=6)]
    errors = validate_result(sets, MatchFormat.PRO_SET_10)
    assert errors == []


def test_valid_fast4():
    sets = [SetScore(winner=4, loser=2), SetScore(winner=4, loser=1)]
    errors = validate_result(sets, MatchFormat.FAST4)
    assert errors == []


def test_retirement_partial_score():
    sets = [SetScore(winner=6, loser=3), SetScore(winner=2, loser=1)]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE, outcome=OutcomeType.RETIRED)
    assert errors == []


def test_walkover_no_show():
    sets = [SetScore(winner=0, loser=0)]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE, outcome=OutcomeType.NO_SHOW)
    assert errors == []


def test_invalid_unfinished_set():
    sets = [SetScore(winner=5, loser=3)]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE)
    assert any("not a valid finished set" in e for e in errors)


def test_wrong_winner_set_count():
    sets = [SetScore(winner=4, loser=6), SetScore(winner=3, loser=6)]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE)
    assert any("Reported winner did not win the required" in e for e in errors)


def test_handicap_headstart_calculation():
    from app.domain.scoring import calculate_handicap_headstart

    # Gap <= 0.5 -> No handicap
    assert calculate_handicap_headstart("p1", 3.5, "p2", 3.0) is None
    assert calculate_handicap_headstart("p1", 3.5, "p2", 3.5) is None

    # Gap between 0.5 and 1.0 (e.g. 0.6 or 0.75) -> 15-0 lead, Ad court, recipient is lower-rated
    hs1 = calculate_handicap_headstart("p1", 4.0, "p2", 3.3)
    assert hs1 is not None
    assert hs1.lead == "15-0"
    assert hs1.court == "Ad court"
    assert hs1.lower_rated_player_id == "p2"
    assert hs1.rating_gap == 0.7

    # Gap >= 1.0 -> 30-0 lead, Deuce court
    hs2 = calculate_handicap_headstart("p1", 3.0, "p2", 4.5)
    assert hs2 is not None
    assert hs2.lead == "30-0"
    assert hs2.court == "Deuce court"
    assert hs2.lower_rated_player_id == "p1"
    assert hs2.rating_gap == 1.5


def test_handicap_eligibility_unverified_player():
    from app.domain.scoring import evaluate_handicap_eligibility

    # Player A has only 5 matches (< 6 required)
    eligible, reason, hs = evaluate_handicap_eligibility(
        player_a_id="p1",
        player_a_rating=4.0,
        player_a_matches=5,
        player_b_id="p2",
        player_b_rating=3.0,
        player_b_matches=10,
        min_qualifying_matches=6,
    )
    assert not eligible
    assert "at least 6 confirmed matches" in (reason or "")
    assert hs is None


def test_handicap_eligibility_insufficient_gap():
    from app.domain.scoring import evaluate_handicap_eligibility

    # Both players verified (>= 6 matches), but rating gap <= 0.5
    eligible, reason, hs = evaluate_handicap_eligibility(
        player_a_id="p1",
        player_a_rating=3.5,
        player_a_matches=6,
        player_b_id="p2",
        player_b_rating=3.0,
        player_b_matches=8,
        min_qualifying_matches=6,
    )
    assert not eligible
    assert "greater than 0.5" in (reason or "")
    assert hs is None


def test_handicap_eligibility_fully_qualified():
    from app.domain.scoring import evaluate_handicap_eligibility

    # Both players verified and gap > 0.5
    eligible, reason, hs = evaluate_handicap_eligibility(
        player_a_id="p1",
        player_a_rating=4.5,
        player_a_matches=7,
        player_b_id="p2",
        player_b_rating=3.5,
        player_b_matches=6,
        min_qualifying_matches=6,
    )
    assert eligible
    assert reason is None
    assert hs is not None
    assert hs.lead == "30-0"
    assert hs.lower_rated_player_id == "p2"


def test_handicap_exact_half_step_ineligible():
    """Approved spec: gap strictly > 0.5; gap of exactly 0.5 is ineligible."""
    from app.domain.scoring import calculate_handicap_headstart, evaluate_handicap_eligibility

    # Exactly 0.5 gap
    assert calculate_handicap_headstart("p1", 4.0, "p2", 3.5) is None
    assert calculate_handicap_headstart("p1", 3.5, "p2", 3.0) is None

    eligible, reason, hs = evaluate_handicap_eligibility(
        player_a_id="p1",
        player_a_rating=4.0,
        player_a_matches=6,
        player_b_id="p2",
        player_b_rating=3.5,
        player_b_matches=6,
        min_qualifying_matches=6,
    )
    assert not eligible
    assert "greater than 0.5" in (reason or "")
    assert hs is None


def test_handicap_unrated_player_ineligible():
    """Unrated players (rating=None) must return clean ineligibility result without 500/crash."""
    from app.domain.scoring import calculate_handicap_headstart, evaluate_handicap_eligibility

    assert calculate_handicap_headstart("p1", None, "p2", 3.5) is None
    assert calculate_handicap_headstart("p1", 3.5, "p2", None) is None
    assert calculate_handicap_headstart("p1", None, "p2", None) is None

    eligible, reason, hs = evaluate_handicap_eligibility(
        player_a_id="p1",
        player_a_rating=None,
        player_a_matches=10,
        player_b_id="p2",
        player_b_rating=3.5,
        player_b_matches=10,
        min_qualifying_matches=6,
    )
    assert not eligible
    assert "rating not available" in (reason or "")
    assert hs is None
