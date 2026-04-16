"""
SQLAlchemy ORM Models for VibeCode.
Maps to PostgreSQL schema with full type safety.
"""

from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, DECIMAL, JSON,
    ForeignKey, UniqueConstraint, Index, CheckConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from uuid import uuid4
from datetime import datetime

Base = declarative_base()


class User(Base):
    """User account model."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    depth_level = Column(String(20), default='beginner', nullable=False)  # eli5/beginner/intermediate/expert

    subscription_tier = Column(String(20), default='free', nullable=False)
    stripe_customer_id = Column(String(100), nullable=True)
    lesson_count_this_month = Column(Integer, default=0)
    lesson_count_reset_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    lessons = relationship("Lesson", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    ratings = relationship("LessonRating", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    review_cards = relationship("ReviewCard", back_populates="user", cascade="all, delete-orphan")
    engagement_events = relationship("EngagementEvent", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


class Lesson(Base):
    """Generated lesson model."""
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    difficulty = Column(String(20))  # beginner, intermediate, advanced
    lesson_json = Column(JSONB, nullable=False)  # Full lesson from Gemini
    source_code = Column(Text)  # Original code
    source_url = Column(String(500))  # Where code came from
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = Column(Boolean, default=False)
    rating_count = Column(Integer, default=0)
    average_rating = Column(DECIMAL(3, 2), default=0)

    # Phase 5: validation + concept graph cache
    validation_status = Column(String(20), nullable=True)       # pass / warn / fail
    validation_notes = Column(Text, nullable=True)
    validation_confidence = Column(DECIMAL(3, 2), nullable=True)
    concepts_json = Column(JSON, nullable=True)                  # {primary_concepts, prerequisites}

    # Phase 6: community features
    fork_count = Column(Integer, default=0)
    upvote_count = Column(Integer, default=0)
    tags_json = Column(JSON, nullable=True)
    forked_from_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    user = relationship("User", back_populates="lessons")
    progress = relationship("UserProgress", back_populates="lesson", cascade="all, delete-orphan")
    ratings = relationship("LessonRating", back_populates="lesson", cascade="all, delete-orphan")
    review_card = relationship("ReviewCard", back_populates="lesson", uselist=False, cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_lessons_user_id', 'user_id'),
    )

    def __repr__(self):
        return f"<Lesson {self.title}>"


class UserProgress(Base):
    """User progress tracking model."""
    __tablename__ = "user_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    current_step = Column(Integer, default=0)
    quiz_scores = Column(JSONB)  # {step_1: 100, step_2: 80}
    exercise_scores = Column(JSONB)  # {step_2_blank_1: true, ...}
    completion_percentage = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_accessed_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="progress")
    lesson = relationship("Lesson", back_populates="progress")

    # Unique constraint: one progress per user-lesson pair
    __table_args__ = (
        UniqueConstraint('user_id', 'lesson_id', name='uq_user_lesson_progress'),
        Index('idx_user_progress_user_id', 'user_id'),
        Index('idx_user_progress_lesson_id', 'lesson_id'),
    )

    def __repr__(self):
        return f"<UserProgress user={self.user_id} lesson={self.lesson_id}>"


class LessonRating(Base):
    """Lesson rating and review model."""
    __tablename__ = "lesson_ratings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    lesson = relationship("Lesson", back_populates="ratings")
    user = relationship("User", back_populates="ratings")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='ck_rating_range'),
        UniqueConstraint('lesson_id', 'user_id', name='uq_lesson_user_rating'),
        Index('idx_lesson_ratings_lesson_id', 'lesson_id'),
    )

    def __repr__(self):
        return f"<LessonRating lesson={self.lesson_id} rating={self.rating}>"


class ReviewCard(Base):
    """
    Spaced repetition card linked to a saved lesson.
    One card per lesson per user — the card represents recall of the whole lesson.
    Future: one card per lesson STEP for granular repetition.
    """
    __tablename__ = "review_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)

    # SM-2 state
    easiness_factor = Column(DECIMAL(4, 2), default=2.5)
    interval_days = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)

    # Scheduling
    due_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_reviewed_at = Column(DateTime(timezone=True))

    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    is_suspended = Column(Boolean, default=False)  # User can pause a card

    # Relationships
    user = relationship("User", back_populates="review_cards")
    lesson = relationship("Lesson", back_populates="review_card")

    __table_args__ = (
        UniqueConstraint('user_id', 'lesson_id', name='uq_user_lesson_card'),
        Index('idx_review_cards_due', 'user_id', 'due_date'),
    )

    def __repr__(self):
        return f"<ReviewCard user={self.user_id} due={self.due_date}>"


class ReviewLog(Base):
    """Every review attempt, immutable. Used for analytics and future FSRS training."""
    __tablename__ = "review_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("review_cards.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)           # 1=Again, 2=Hard, 3=Good, 4=Easy
    reviewed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    interval_before = Column(Integer)                  # interval before this review
    easiness_before = Column(DECIMAL(4, 2))            # EF before this review

    __table_args__ = (
        Index('idx_review_logs_card', 'card_id'),
        Index('idx_review_logs_user_date', 'user_id', 'reviewed_at'),
    )


class RefreshToken(Base):
    """Refresh token model for logout and security."""
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    revoked_at = Column(DateTime(timezone=True))  # NULL = active, not NULL = revoked

    # Relationship
    user = relationship("User", back_populates="refresh_tokens")

    def is_valid(self) -> bool:
        """Check if token is still valid."""
        return self.revoked_at is None and datetime.utcnow() < self.expires_at

    def __repr__(self):
        return f"<RefreshToken user={self.user_id}>"


# ===== PHASE 5 MODELS =====

class EngagementEvent(Base):
    """
    Aha-moment detector inputs. Tracks micro-behaviours during lesson consumption.

    event_type values:
      step_time   — seconds spent on a step (value = float seconds)
      code_replay — user re-ran a code block (value = replay count)
      quiz_retry  — user re-attempted after wrong answer (value = attempt number)
      step_reread — user navigated back to a completed step (value = 1.0)

    These events feed the aha-moment scoring logic:
      slow_read + correct_answer + re_read = anchor memory candidate
      → ReviewCard for this step gets boosted weight in SM-2
    """
    __tablename__ = "engagement_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True)
    event_type = Column(String(50), nullable=False)
    step_id = Column(String(100), nullable=True)
    value = Column(DECIMAL(10, 3), nullable=True)
    metadata = Column(JSON, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="engagement_events")

    __table_args__ = (
        Index('idx_engagement_user', 'user_id', 'recorded_at'),
        Index('idx_engagement_type', 'event_type'),
    )

    def __repr__(self):
        return f"<EngagementEvent {self.event_type} user={self.user_id}>"


# ===== PHASE 6 MODELS =====

class LessonUpvote(Base):
    __tablename__ = "lesson_upvotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('lesson_id', 'user_id', name='uq_lesson_upvote'),
        Index('idx_upvotes_lesson', 'lesson_id'),
    )

    def __repr__(self):
        return f"<LessonUpvote lesson={self.lesson_id} user={self.user_id}>"
