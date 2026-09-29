"""add_avatar_url_to_player_profile

Revision ID: 3c7e9a1b8d2f
Revises: 25465db304ad
Create Date: 2026-09-29 10:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3c7e9a1b8d2f"
down_revision: str | Sequence[str] | None = "25465db304ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add avatar_url column to player_profiles."""
    op.add_column(
        "player_profiles",
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema: remove avatar_url column from player_profiles."""
    op.drop_column("player_profiles", "avatar_url")
