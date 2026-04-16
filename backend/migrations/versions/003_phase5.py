"""Phase 5: depth level, concept graph, engagement events, lesson validation

Revision ID: 003
Revises: 002
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # ── User: explanation depth preference ────────────────────────────────
    op.add_column(
        'users',
        sa.Column('depth_level', sa.String(20), nullable=False, server_default='beginner')
    )

    # ── Lesson: validation pass results + concept cache ───────────────────
    op.add_column('lessons', sa.Column('validation_status', sa.String(20), nullable=True))
    op.add_column('lessons', sa.Column('validation_notes', sa.Text, nullable=True))
    op.add_column('lessons', sa.Column('validation_confidence', sa.Float, nullable=True))
    op.add_column('lessons', sa.Column('concepts_json', sa.JSON, nullable=True))

    # ── Concept nodes ─────────────────────────────────────────────────────
    op.create_table(
        'concepts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('normalized_name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index('ix_concepts_normalized', 'concepts', ['normalized_name'], unique=True)

    # ── Lesson ↔ Concept many-to-many ─────────────────────────────────────
    op.create_table(
        'lesson_concepts',
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('lessons.id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('concepts.id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default='true'),
    )

    # ── Concept prerequisite edges (directed) ─────────────────────────────
    op.create_table(
        'concept_prerequisites',
        sa.Column('concept_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('concepts.id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('prerequisite_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('concepts.id', ondelete='CASCADE'),
                  primary_key=True),
    )

    # ── Engagement events (aha detector inputs) ───────────────────────────
    op.create_table(
        'engagement_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('step_id', sa.String(100), nullable=True),
        sa.Column('value', sa.Float, nullable=True),
        sa.Column('metadata', sa.JSON, nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index('ix_engagement_user', 'engagement_events', ['user_id', 'recorded_at'])
    op.create_index('ix_engagement_type', 'engagement_events', ['event_type'])


def downgrade():
    op.drop_index('ix_engagement_type')
    op.drop_index('ix_engagement_user')
    op.drop_table('engagement_events')
    op.drop_table('concept_prerequisites')
    op.drop_table('lesson_concepts')
    op.drop_index('ix_concepts_normalized')
    op.drop_table('concepts')
    op.drop_column('lessons', 'concepts_json')
    op.drop_column('lessons', 'validation_confidence')
    op.drop_column('lessons', 'validation_notes')
    op.drop_column('lessons', 'validation_status')
    op.drop_column('users', 'depth_level')
