"""Phase 6: subscription tiers, community features, lesson upvotes/forks

Revision ID: 004
Revises: 003
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # ── User: subscription / billing / usage tracking ─────────────────────
    op.add_column(
        'users',
        sa.Column('subscription_tier', sa.String(20), nullable=False, server_default='free')
    )
    op.add_column(
        'users',
        sa.Column('stripe_customer_id', sa.String(100), nullable=True)
    )
    op.add_column(
        'users',
        sa.Column('lesson_count_this_month', sa.Integer, nullable=True, server_default='0')
    )
    op.add_column(
        'users',
        sa.Column('lesson_count_reset_at', sa.DateTime(timezone=True), nullable=True)
    )

    # ── Lesson: community stats + fork lineage ─────────────────────────────
    op.add_column('lessons', sa.Column('fork_count', sa.Integer, nullable=True, server_default='0'))
    op.add_column('lessons', sa.Column('upvote_count', sa.Integer, nullable=True, server_default='0'))
    op.add_column('lessons', sa.Column('tags_json', sa.JSON, nullable=True))
    op.add_column(
        'lessons',
        sa.Column(
            'forked_from_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('lessons.id', ondelete='SET NULL'),
            nullable=True,
        )
    )

    # ── Lesson upvotes (many-to-many, unique per user+lesson) ─────────────
    op.create_table(
        'lesson_upvotes',
        sa.Column(
            'id', postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text('gen_random_uuid()')
        ),
        sa.Column(
            'lesson_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('lesson_id', 'user_id', name='uq_lesson_upvote'),
    )
    op.create_index('idx_upvotes_lesson', 'lesson_upvotes', ['lesson_id'])


def downgrade():
    op.drop_index('idx_upvotes_lesson', table_name='lesson_upvotes')
    op.drop_table('lesson_upvotes')
    op.drop_column('lessons', 'forked_from_id')
    op.drop_column('lessons', 'tags_json')
    op.drop_column('lessons', 'upvote_count')
    op.drop_column('lessons', 'fork_count')
    op.drop_column('users', 'lesson_count_reset_at')
    op.drop_column('users', 'lesson_count_this_month')
    op.drop_column('users', 'stripe_customer_id')
    op.drop_column('users', 'subscription_tier')
