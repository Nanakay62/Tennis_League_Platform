"""region on programs + home_area constraint + check constraints

Revision ID: 6a0b1c2d3e4f
Revises: 5e9a1b2c3d4f
Create Date: 2026-10-04 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a0b1c2d3e4f"
down_revision: str | Sequence[str] | None = "5e9a1b2c3d4f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. programs.region
    op.add_column(
        "programs",
        sa.Column("region", sa.String(length=16), nullable=False, server_default="Accra"),
    )
    op.execute("UPDATE programs SET region='Tema' WHERE id='prog-tema-fall-2026'")
    op.create_check_constraint("ck_programs_region", "programs", "region IN ('Accra', 'Tema')")

    # 2. player_profiles.home_area: constrain going forward without rewriting/mapping stale rows
    op.alter_column("player_profiles", "home_area", server_default="Accra")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """ALTER TABLE player_profiles ADD CONSTRAINT ck_player_profiles_home_area
               CHECK (home_area IN ('Accra', 'Tema')) NOT VALID"""
        )
    else:
        op.create_check_constraint(
            "ck_player_profiles_home_area", "player_profiles", "home_area IN ('Accra', 'Tema')"
        )

    # 3. Domain value check constraints matching exact application code enums
    op.create_check_constraint(
        "ck_player_profiles_gender",
        "player_profiles",
        "gender IN ('male', 'female', 'non_binary', 'unspecified')",
    )
    op.create_check_constraint(
        "ck_divisions_gender_constraint",
        "divisions",
        "gender_constraint IN ('open', 'men', 'women')",
    )
    op.create_check_constraint(
        "ck_player_profiles_birth_year",
        "player_profiles",
        "birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100)",
    )
    op.create_check_constraint(
        "ck_matches_handicap_lead",
        "matches",
        "handicap_lead IS NULL OR handicap_lead IN ('15-0', '30-0')",
    )

    # 4. Unique constraints for duplicate prevention
    op.create_unique_constraint(
        "uq_enrollments_user_program", "enrollments", ["user_id", "program_id"]
    )
    op.create_unique_constraint("uq_court_review_user", "court_reviews", ["court_id", "user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_court_review_user", "court_reviews", type_="unique")
    op.drop_constraint("uq_enrollments_user_program", "enrollments", type_="unique")

    op.drop_constraint("ck_matches_handicap_lead", "matches", type_="check")
    op.drop_constraint("ck_player_profiles_birth_year", "player_profiles", type_="check")
    op.drop_constraint("ck_divisions_gender_constraint", "divisions", type_="check")
    op.drop_constraint("ck_player_profiles_gender", "player_profiles", type_="check")
    op.drop_constraint("ck_player_profiles_home_area", "player_profiles", type_="check")
    op.alter_column("player_profiles", "home_area", server_default="")

    op.drop_constraint("ck_programs_region", "programs", type_="check")
    op.drop_column("programs", "region")
