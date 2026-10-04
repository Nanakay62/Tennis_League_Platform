"""add_gender_and_age_constraints

Revision ID: 4d8f0a2c9e1b
Revises: 3c7e9a1b8d2f
Create Date: 2026-10-03 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4d8f0a2c9e1b"
down_revision: str | Sequence[str] | None = "3c7e9a1b8d2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add gender and birth_year to player_profiles, and constraints to divisions."""
    op.add_column(
        "player_profiles",
        sa.Column(
            "gender",
            sa.String(length=20),
            nullable=False,
            server_default="unspecified",
        ),
    )
    op.add_column(
        "player_profiles",
        sa.Column("birth_year", sa.Integer(), nullable=True),
    )
    op.add_column(
        "divisions",
        sa.Column(
            "gender_constraint",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
    )
    op.add_column(
        "divisions",
        sa.Column("min_age", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema: remove columns."""
    op.drop_column("divisions", "min_age")
    op.drop_column("divisions", "gender_constraint")
    op.drop_column("player_profiles", "birth_year")
    op.drop_column("player_profiles", "gender")
