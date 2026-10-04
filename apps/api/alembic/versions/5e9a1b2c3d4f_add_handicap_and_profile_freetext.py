"""add_handicap_and_profile_freetext

Revision ID: 5e9a1b2c3d4f
Revises: 4d8f0a2c9e1b
Create Date: 2026-10-03 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e9a1b2c3d4f"
down_revision: str | Sequence[str] | None = "4d8f0a2c9e1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add handicap columns to matches and free-text fields to player_profiles."""
    # Matches handicap columns
    op.add_column(
        "matches",
        sa.Column(
            "is_handicap",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "matches",
        sa.Column("handicap_lead", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "matches",
        sa.Column(
            "handicap_recipient_id",
            sa.String(length=36),
            sa.ForeignKey("player_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # PlayerProfile free-text fields
    op.add_column(
        "player_profiles",
        sa.Column("favorite_link", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "player_profiles",
        sa.Column("game_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "player_profiles",
        sa.Column("about_me", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema: remove columns."""
    op.drop_column("player_profiles", "about_me")
    op.drop_column("player_profiles", "game_description")
    op.drop_column("player_profiles", "favorite_link")

    op.drop_column("matches", "handicap_recipient_id")
    op.drop_column("matches", "handicap_lead")
    op.drop_column("matches", "is_handicap")
