"""Unit tests for pure domain player division eligibility constraints.

Validates gender constraints, age restrictions (exact boundary, underage, missing birth year),
open divisions, and whitespace/case tolerance.
"""

from app.domain.eligibility import (
    DivisionGenderConstraint,
    PlayerGender,
    check_division_eligibility,
)


def test_open_division_allows_all_genders_and_ages():
    """Open divisions must accept any gender and any age (with or without birth year)."""
    current_year = 2026

    for gender in [
        PlayerGender.MALE,
        PlayerGender.FEMALE,
        PlayerGender.NON_BINARY,
        PlayerGender.UNSPECIFIED,
        "custom",
        "",
    ]:
        eligible, reason = check_division_eligibility(
            player_gender=gender,
            player_birth_year=None,
            division_gender_constraint=DivisionGenderConstraint.OPEN,
            division_min_age=None,
            current_year=current_year,
        )
        assert eligible is True
        assert reason is None


def test_mens_division_gender_constraints():
    """Men's division permits only male players; rejects female, non-binary, and unspecified."""
    current_year = 2026

    # Eligible: male
    eligible, reason = check_division_eligibility(
        player_gender="male",
        player_birth_year=1995,
        division_gender_constraint="men",
        division_min_age=None,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None

    # Ineligible: female, non-binary, unspecified
    for gender in ["female", "non_binary", "unspecified", ""]:
        eligible, reason = check_division_eligibility(
            player_gender=gender,
            player_birth_year=1995,
            division_gender_constraint="men",
            division_min_age=None,
            current_year=current_year,
        )
        assert eligible is False
        assert "restricted to Men's players" in str(reason)


def test_womens_division_gender_constraints():
    """Women's division permits only female players; rejects male, non-binary, and unspecified."""
    current_year = 2026

    # Eligible: female
    eligible, reason = check_division_eligibility(
        player_gender="female",
        player_birth_year=1995,
        division_gender_constraint="women",
        division_min_age=None,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None

    # Ineligible: male, non-binary, unspecified
    for gender in ["male", "non_binary", "unspecified", ""]:
        eligible, reason = check_division_eligibility(
            player_gender=gender,
            player_birth_year=1995,
            division_gender_constraint="women",
            division_min_age=None,
            current_year=current_year,
        )
        assert eligible is False
        assert "restricted to Women's players" in str(reason)


def test_case_insensitivity_and_whitespace_tolerance():
    """Gender constraints and player genders must normalize whitespace and casing."""
    current_year = 2026

    eligible, reason = check_division_eligibility(
        player_gender="  MALE \n",
        player_birth_year=1990,
        division_gender_constraint="  MEN  ",
        division_min_age=None,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None

    eligible, reason = check_division_eligibility(
        player_gender="  Female ",
        player_birth_year=1990,
        division_gender_constraint=" WOMEN ",
        division_min_age=None,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None


def test_min_age_boundary_conditions():
    """Test min_age boundary: exact match (eligible), underage (ineligible), older (eligible)."""
    current_year = 2026
    min_age = 40  # 40+ Senior division

    # Exact min_age match: birth year 1986 -> age 40 in 2026 -> Eligible
    eligible, reason = check_division_eligibility(
        player_gender="male",
        player_birth_year=1986,
        division_gender_constraint="open",
        division_min_age=min_age,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None

    # Older than min_age: birth year 1980 -> age 46 in 2026 -> Eligible
    eligible, reason = check_division_eligibility(
        player_gender="male",
        player_birth_year=1980,
        division_gender_constraint="open",
        division_min_age=min_age,
        current_year=current_year,
    )
    assert eligible is True
    assert reason is None

    # Underage: birth year 1987 -> age 39 in 2026 -> Ineligible
    eligible, reason = check_division_eligibility(
        player_gender="male",
        player_birth_year=1987,
        division_gender_constraint="open",
        division_min_age=min_age,
        current_year=current_year,
    )
    assert eligible is False
    assert "at least 40 years old (current age: 39)" in str(reason)


def test_missing_birth_year_in_age_restricted_division():
    """Players without birth_year in an age-restricted division must be prompted to enter it."""
    current_year = 2026

    eligible, reason = check_division_eligibility(
        player_gender="male",
        player_birth_year=None,
        division_gender_constraint="open",
        division_min_age=40,
        current_year=current_year,
    )
    assert eligible is False
    assert "requires players to be 40+" in str(reason)
    assert "Please specify your birth year in your profile" in str(reason)
