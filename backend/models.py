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

    # Relationships
    lessons = relationship("Lesson", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    ratings = relationship("LessonRating", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    review_cards = relationship("ReviewCard", back_populates="user", cascade="all, delete-orphan")

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
