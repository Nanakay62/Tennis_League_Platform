"""Hypothesis property tests for score validation invariants."""

from hypothesis import given
from hypothesis import strategies as st

from app.domain.scoring import MatchFormat, SetScore, set_is_complete, validate_result


@given(
    winner_games=st.integers(min_value=0, max_value=7),
    loser_games=st.integers(min_value=0, max_value=7),
)
def test_standard_set_completion_invariants(winner_games: int, loser_games: int):
    """A standard 6-game set can only be complete if:
    - 6-0 to 6-4
    - 7-5
    - 7-6
    """
    s = SetScore(winner=winner_games, loser=loser_games)
    complete = set_is_complete(s, MatchFormat.BEST_OF_THREE)
    hi, lo = max(winner_games, loser_games), min(winner_games, loser_games)

    if complete:
        assert (hi == 6 and lo <= 4) or (hi == 7 and lo in (5, 6))
    else:
        assert not ((hi == 6 and lo <= 4) or (hi == 7 and lo in (5, 6)))


@given(
    st.lists(
        st.tuples(st.integers(min_value=0, max_value=15), st.integers(min_value=0, max_value=15)),
        min_size=0,
        max_size=5,
    )
)
def test_validate_result_never_crashes(raw_sets):
    """validate_result must return a list of error strings for any arbitrary numeric input without raising unhandled exceptions."""
    sets = [SetScore(winner=w, loser=l) for w, l in raw_sets]
    errors = validate_result(sets, MatchFormat.BEST_OF_THREE)
    assert isinstance(errors, list)
    for err in errors:
        assert isinstance(err, str)
