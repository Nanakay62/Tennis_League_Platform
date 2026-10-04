"""Pure domain module for player division eligibility constraints (gender & age).

No framework dependencies (no FastAPI, no SQLAlchemy).
All rules operate as pure functions with unit tests.
"""

from enum import StrEnum


class PlayerGender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    NON_BINARY = "non_binary"
    UNSPECIFIED = "unspecified"


class DivisionGenderConstraint(StrEnum):
    OPEN = "open"
    MEN = "men"
    WOMEN = "women"


def check_division_eligibility(
    player_gender: str,
    player_birth_year: int | None,
    division_gender_constraint: str,
    division_min_age: int | None,
    current_year: int,
) -> tuple[bool, str | None]:
    """Validate whether a player satisfies a division's gender and age constraints.

    Returns:
        (True, None) if eligible.
        (False, reason_string) if ineligible.
    """
    normalized_gender = (player_gender or PlayerGender.UNSPECIFIED).strip().lower()
    normalized_constraint = (
        (division_gender_constraint or DivisionGenderConstraint.OPEN).strip().lower()
    )

    # 1. Gender check
    if (
        normalized_constraint == DivisionGenderConstraint.MEN
        and normalized_gender != PlayerGender.MALE
    ):
        return False, "This division is restricted to Men's players."
    if (
        normalized_constraint == DivisionGenderConstraint.WOMEN
        and normalized_gender != PlayerGender.FEMALE
    ):
        return False, "This division is restricted to Women's players."

    # 2. Age check
    if division_min_age is not None:
        if player_birth_year is None:
            return (
                False,
                f"This division requires players to be {division_min_age}+. Please specify your birth year in your profile.",
            )
        player_age = current_year - player_birth_year
        if player_age < division_min_age:
            return (
                False,
                f"This division requires players to be at least {division_min_age} years old (current age: {player_age}).",
            )

    return True, None
