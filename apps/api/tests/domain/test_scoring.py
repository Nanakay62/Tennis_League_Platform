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
