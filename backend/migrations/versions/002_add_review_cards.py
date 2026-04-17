"""002 - Add spaced repetition tables

Adds: review_cards, review_logs
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = '002'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'review_cards',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lesson_id', UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('easiness_factor', sa.Numeric(4, 2), default=2.5, nullable=False, server_default='2.5'),
        sa.Column('interval_days', sa.Integer, default=1, nullable=False, server_default='1'),
        sa.Column('repetitions', sa.Integer, default=0, nullable=False, server_default='0'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('is_suspended', sa.Boolean, default=False, server_default='false'),
        sa.UniqueConstraint('user_id', 'lesson_id', name='uq_user_lesson_card'),
    )
    op.create_index('idx_review_cards_due', 'review_cards', ['user_id', 'due_date'])

    op.create_table(
        'review_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('card_id', UUID(as_uuid=True), sa.ForeignKey('review_cards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer, nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('interval_before', sa.Integer),
        sa.Column('easiness_before', sa.Numeric(4, 2)),
    )
    op.create_index('idx_review_logs_card', 'review_logs', ['card_id'])
    op.create_index('idx_review_logs_user_date', 'review_logs', ['user_id', 'reviewed_at'])


def downgrade():
    op.drop_index('idx_review_logs_user_date')
    op.drop_index('idx_review_logs_card')
    op.drop_table('review_logs')
    op.drop_index('idx_review_cards_due')
    op.drop_table('review_cards')
