"""
Spaced Repetition Scheduler using SM-2 algorithm.
Upgrade path to FSRS-4.5 documented inline when user base has enough data.

SM-2 chosen for Phase 4 because:
- Zero cold-start problem (works on card 1)
- FSRS needs per-user training data to outperform SM-2 (needs ~500 reviews)
- SM-2 is still 60%+ better than no repetition at all

Rating scale (matches Anki convention):
  1 = Again  (complete blackout, reset interval)
  2 = Hard   (wrong but remembered with effort)
  3 = Good   (correct after hesitation)
  4 = Easy   (perfect recall, fast)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Tuple
import math


# SM-2 quality mapping from user-facing ratings
RATING_TO_QUALITY = {
    1: 0,  # Again  → quality 0 (complete failure)
    2: 2,  # Hard   → quality 2 (significant difficulty)
    3: 4,  # Good   → quality 4 (correct after hesitation)
    4: 5,  # Easy   → quality 5 (perfect recall)
}


@dataclass
class CardState:
    """Mutable state for a single review card."""
    easiness_factor: float = 2.5   # EF, min 1.3
    interval_days: int = 1          # days until next review
    repetitions: int = 0            # successful review streak
    due_date: datetime = field(default_factory=datetime.utcnow)
    last_reviewed_at: datetime = None


def sm2_schedule(state: CardState, rating: int) -> CardState:
    """
    Apply SM-2 algorithm and return updated card state.

    Args:
        state: Current card state
        rating: User rating 1-4 (Again/Hard/Good/Easy)

    Returns:
        Updated CardState with new interval, EF, and due_date

    SM-2 paper: Wozniak 1990
    """
    quality = RATING_TO_QUALITY.get(rating, 2)

    if quality >= 3:
        # Successful recall
        if state.repetitions == 0:
            new_interval = 1
        elif state.repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(state.interval_days * state.easiness_factor)

        state.repetitions += 1
    else:
        # Failed recall — reset streak, short interval
        state.repetitions = 0
        new_interval = 1

    # Update easiness factor
    new_ef = state.easiness_factor + (
        0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
    state.easiness_factor = max(1.3, new_ef)
    state.interval_days = new_interval
    state.last_reviewed_at = datetime.utcnow()
    state.due_date = datetime.utcnow() + timedelta(days=new_interval)

    return state


def days_until_due(due_date: datetime) -> int:
    """Return how many days until a card is due (negative = overdue)."""
    delta = due_date - datetime.utcnow()
    return math.ceil(delta.total_seconds() / 86400)


def estimated_retention(interval_days: int, elapsed_days: int, stability: float = None) -> float:
    """
    Estimate probability of recall using exponential forgetting curve.
    R = e^(-elapsed/stability)
    stability defaults to interval (SM-2 assumption)
    """
    s = stability or max(interval_days, 1)
    return math.exp(-elapsed_days / s)


# ===== FSRS UPGRADE PATH =====
# When user base reaches ~500 reviews per user, swap sm2_schedule for fsrs_schedule.
# FSRS-4.5 uses 17 pretrained weights and tracks memory stability separately.
# Reference: https://github.com/open-spaced-repetition/fsrs4anki
#
# def fsrs_schedule(state: CardState, rating: int, w: list[float]) -> CardState:
#     ...
#
# For now, SM-2 is the right call. Don't over-engineer.
