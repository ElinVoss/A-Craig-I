from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthCredential
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uvicorn
import logging
from datetime import timedelta, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from lesson_generator import LessonGenerator
from schemas import Lesson
from database import get_db, init_db, check_db_health
from models import User, Lesson as LessonModel, UserProgress, LessonRating, RefreshToken, ReviewCard, ReviewLog, EngagementEvent
from auth import (
    hash_password, verify_password, 
    create_token_pair, decode_access_token, decode_refresh_token,
    hash_token, verify_token_hash,
    validate_password_strength, TokenResponse, REFRESH_TOKEN_EXPIRE_DAYS
)
from srs import CardState, sm2_schedule

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VibeCode Engine Phase 3", version="1.1.0")

# Allow requests from the Chrome extension and React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Initialize the lesson generator
try:
    lesson_generator = LessonGenerator()
    logger.info("✅ Lesson generator initialized with Gemini API")
except ValueError as e:
    logger.warning(f"⚠️ Lesson generator not available: {e}")
    lesson_generator = None


# ===== PYDANTIC MODELS (REQUEST/RESPONSE) =====

class CodeIngestion(BaseModel):
    code: str
    context: str
    url: str
    source_model: Optional[str] = "Unknown"


class LessonGenerationRequest(BaseModel):
    code: str
    context: str
    url: str
    source_model: Optional[str] = "Unknown"
    difficulty: Optional[str] = "beginner"


class UserSignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str
    is_active: bool
    
    class Config:
        from_attributes = True


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ===== AUTHENTICATION ENDPOINTS =====

@app.post("/api/auth/signup", response_model=dict)
async def signup(request: UserSignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user account.
    
    Requirements:
    - Email must be unique
    - Username must be 3-100 characters and unique
    - Password must be 8+ characters with uppercase, lowercase, digit
    """
    # Validate password strength
    is_valid, message = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == request.email.lower()).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == request.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )
    
    # Create new user
    user = User(
        email=request.email.lower(),
        username=request.username,
        password_hash=hash_password(request.password)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info(f"✅ New user registered: {user.email}")
    
    # Generate tokens
    tokens = create_token_pair(str(user.id), user.email)
    
    # Store refresh token
    refresh_token_hash = hash_token(tokens.refresh_token)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_refresh_token)
    db.commit()
    
    return {
        "status": "success",
        "message": "User registered successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
        },
        "tokens": {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_type": tokens.token_type,
            "expires_in": tokens.expires_in
        }
    }


@app.post("/api/auth/login", response_model=dict)
async def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password.
    Returns access and refresh tokens.
    """
    user = db.query(User).filter(User.email == request.email.lower()).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    logger.info(f"✅ User logged in: {user.email}")
    
    # Generate tokens
    tokens = create_token_pair(str(user.id), user.email)
    
    # Store refresh token
    refresh_token_hash = hash_token(tokens.refresh_token)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_refresh_token)
    db.commit()
    
    return {
        "status": "success",
        "message": "Login successful",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
        },
        "tokens": {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_type": tokens.token_type,
            "expires_in": tokens.expires_in
        }
    }


@app.post("/api/auth/refresh", response_model=dict)
async def refresh_access_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Use refresh token to get a new access token.
    """
    payload = decode_refresh_token(request.refresh_token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    
    # Check if refresh token is stored and not revoked
    db_token = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None
    ).first()
    
    if not db_token or not verify_token_hash(request.refresh_token, db_token.token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or invalid"
        )
    
    # Create new access token
    new_access_token = create_token_pair(user_id, email)
    
    return {
        "status": "success",
        "tokens": {
            "access_token": new_access_token.access_token,
            "token_type": new_access_token.token_type,
            "expires_in": new_access_token.expires_in
        }
    }


# ===== PROTECTED ROUTE HELPER =====

async def get_current_user(
    credentials: HTTPAuthCredential = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user.
    Validates JWT token and returns user object.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


# ===== LESSON ENDPOINTS =====

@app.post("/ingest")
async def ingest_conversation(data: CodeIngestion):
    """Legacy endpoint: Ingest code from browser extension."""
    logger.info(f"📥 Received code from: {data.url}")
    logger.info(f"📝 Context preview: {data.context[:100]}...")
    logger.info(f"💾 Code length: {len(data.code)} characters")
    
    project_id = "vibe_" + str(hash(data.url))[:8]
    
    return {
        "status": "success",
        "message": "Project data cached. Ready for deconstruction.",
        "project_id": project_id,
        "next_action": f"POST /generate-lesson to create interactive lesson"
    }


@app.post("/generate-lesson")
async def generate_lesson(request: LessonGenerationRequest):
    """
    Generate an interactive lesson from code (legacy, no auth).
    """
    if not lesson_generator:
        raise HTTPException(
            status_code=503,
            detail="Lesson generation service unavailable. Set GEMINI_API_KEY environment variable."
        )
    
    try:
        logger.info(f"🔄 Generating lesson for code from: {request.url}")
        
        lesson_data = lesson_generator.generate_lesson_structured(
            code=request.code,
            context=request.context,
            url=request.url,
            source_model=request.source_model,
            difficulty=request.difficulty,
        )
        
        logger.info(f"✨ Lesson generated successfully")
        
        return {
            "status": "success",
            "message": "Lesson generated and ready for rendering",
            "data": lesson_data,
        }
        
    except Exception as e:
        logger.error(f"❌ Lesson generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate lesson: {str(e)}"
        )


@app.post("/api/lessons/generate")
async def generate_and_save_lesson(
    request: LessonGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a lesson and save it to user's library.
    Requires authentication.
    """
    if not lesson_generator:
        raise HTTPException(
            status_code=503,
            detail="Lesson generation service unavailable."
        )
    
    try:
        logger.info(f"🔄 Generating lesson for user: {current_user.email}")
        
        # Generate lesson — pass user's depth level for personalised explanations
        lesson_data = lesson_generator.generate_lesson_structured(
            code=request.code,
            context=request.context,
            url=request.url,
            source_model=request.source_model,
            difficulty=request.difficulty,
            depth_level=getattr(current_user, 'depth_level', 'beginner'),
        )

        # Run validation pass (non-blocking — lesson saved regardless)
        validation = {"status": None, "issues": [], "confidence": None}
        try:
            lesson_dict = lesson_data.get('lesson', lesson_data)
            validation = lesson_generator.validate_lesson(lesson_dict)
        except Exception as ve:
            logger.warning(f"⚠️ Validation pass failed (non-fatal): {ve}")

        # Extract concept graph (non-blocking)
        concepts_json = None
        try:
            lesson_dict = lesson_data.get('lesson', lesson_data)
            concepts_json = lesson_generator.extract_concepts(lesson_dict)
        except Exception as ce:
            logger.warning(f"⚠️ Concept extraction failed (non-fatal): {ce}")

        # Save to database
        db_lesson = LessonModel(
            user_id=current_user.id,
            title=lesson_data.get('lesson', lesson_data).get('title', 'Untitled'),
            description=lesson_data.get('lesson', lesson_data).get('description', ''),
            difficulty=lesson_data.get('lesson', lesson_data).get('difficulty', 'beginner'),
            lesson_json=lesson_data,
            source_code=request.code,
            source_url=request.url,
            validation_status=validation.get('status'),
            validation_notes='; '.join(validation.get('issues', [])) or None,
            validation_confidence=validation.get('confidence'),
            concepts_json=concepts_json,
        )
        
        db.add(db_lesson)
        db.commit()
        db.refresh(db_lesson)
        
        logger.info(f"✅ Lesson saved: {db_lesson.id} | validation={validation.get('status')}")
        
        return {
            "status": "success",
            "message": "Lesson generated and saved",
            "lesson_id": str(db_lesson.id),
            "validation": {
                "status": validation.get('status'),
                "issues": validation.get('issues', []),
                "confidence": validation.get('confidence'),
            },
            "concepts": concepts_json,
            "data": lesson_data,
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to generate/save lesson: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate lesson: {str(e)}"
        )


@app.get("/api/lessons")
async def get_user_lessons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all lessons for current user."""
    lessons = db.query(LessonModel).filter(
        LessonModel.user_id == current_user.id
    ).order_by(LessonModel.created_at.desc()).all()
    
    return {
        "status": "success",
        "count": len(lessons),
        "lessons": [
            {
                "id": str(lesson.id),
                "title": lesson.title,
                "description": lesson.description,
                "difficulty": lesson.difficulty,
                "created_at": lesson.created_at.isoformat(),
                "rating": lesson.average_rating,
                "is_completed": any(p.is_completed for p in lesson.progress if p.user_id == current_user.id)
            }
            for lesson in lessons
        ]
    }


@app.get("/api/lessons/{lesson_id}")
async def get_lesson_detail(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific lesson with full data."""
    lesson = db.query(LessonModel).filter(
        LessonModel.id == lesson_id,
        LessonModel.user_id == current_user.id
    ).first()
    
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )
    
    # Get or create progress
    progress = db.query(UserProgress).filter(
        UserProgress.lesson_id == lesson.id,
        UserProgress.user_id == current_user.id
    ).first()
    
    if not progress:
        progress = UserProgress(
            user_id=current_user.id,
            lesson_id=lesson.id,
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)
    
    return {
        "status": "success",
        "lesson": lesson.lesson_json,
        "progress": {
            "current_step": progress.current_step,
            "completion_percentage": progress.completion_percentage,
            "is_completed": progress.is_completed,
            "quiz_scores": progress.quiz_scores or {},
            "exercise_scores": progress.exercise_scores or {},
        }
    }


@app.post("/api/progress/{lesson_id}")
async def save_lesson_progress(
    lesson_id: str,
    progress_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save user progress on a lesson."""
    progress = db.query(UserProgress).filter(
        UserProgress.lesson_id == lesson_id,
        UserProgress.user_id == current_user.id
    ).first()
    
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress not found"
        )
    
    # Update progress
    progress.current_step = progress_data.get("current_step", progress.current_step)
    progress.completion_percentage = progress_data.get("completion_percentage", progress.completion_percentage)
    progress.quiz_scores = progress_data.get("quiz_scores", progress.quiz_scores)
    progress.exercise_scores = progress_data.get("exercise_scores", progress.exercise_scores)
    
    if progress_data.get("is_completed"):
        progress.is_completed = True
        progress.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "message": "Progress saved"
    }


# ===== PHASE 5 ENDPOINTS =====

class DepthUpdateRequest(BaseModel):
    depth_level: str = Field(..., pattern='^(eli5|beginner|intermediate|expert)$')


@app.patch("/api/me/depth")
async def update_depth_level(
    body: DepthUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the user's explanation depth preference. Applied to all future lesson generations."""
    current_user.depth_level = body.depth_level
    db.commit()
    return {"status": "success", "depth_level": body.depth_level}


class EngagementEventModel(BaseModel):
    lesson_id: Optional[str] = None
    event_type: str           # step_time | code_replay | quiz_retry | step_reread
    step_id: Optional[str] = None
    value: Optional[float] = None
    metadata: Optional[dict] = None


@app.post("/api/events")
async def ingest_engagement_events(
    events: list[EngagementEventModel],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Batch ingest engagement events for aha-moment detection.
    Fire-and-forget — frontend doesn't need to wait.
    Events are used to identify anchor memories and boost review card weights.
    """
    for e in events:
        db_event = EngagementEvent(
            user_id=current_user.id,
            lesson_id=e.lesson_id,
            event_type=e.event_type,
            step_id=e.step_id,
            value=e.value,
            metadata=e.metadata,
        )
        db.add(db_event)

    # Aha-moment detection: step_time > 45s on a step that was then answered correctly
    # is a strong signal — flag those review cards for priority scheduling
    for e in events:
        if e.event_type == 'step_time' and e.value and e.value > 45 and e.lesson_id:
            card = db.query(ReviewCard).filter(
                ReviewCard.user_id == current_user.id,
                ReviewCard.lesson_id == e.lesson_id,
            ).first()
            if card:
                # Boost easiness factor slightly — the extra time spent paid off
                new_ef = min(float(card.easiness_factor) + 0.1, 3.0)
                card.easiness_factor = new_ef
                logger.info(f"🧠 Aha-moment detected on step {e.step_id} — boosted EF to {new_ef:.2f}")

    db.commit()
    return {"status": "success", "events_recorded": len(events)}


@app.get("/api/lessons/{lesson_id}/concepts")
async def get_lesson_concepts(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return cached concept graph for a lesson.
    If not yet extracted (older lessons), trigger extraction now.
    Also cross-references with user's existing lessons to flag covered/missing prereqs.
    """
    lesson = db.query(LessonModel).filter(
        LessonModel.id == lesson_id,
        LessonModel.user_id == current_user.id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Trigger extraction if missing
    if not lesson.concepts_json and lesson_generator:
        try:
            lesson_dict = lesson.lesson_json
            if isinstance(lesson_dict, dict) and 'lesson' in lesson_dict:
                lesson_dict = lesson_dict['lesson']
            concepts = lesson_generator.extract_concepts(lesson_dict)
            lesson.concepts_json = concepts
            db.commit()
        except Exception as e:
            logger.warning(f"⚠️ Concept extraction failed: {e}")

    concepts = lesson.concepts_json or {}
    prerequisites = concepts.get('prerequisites', [])

    # Check which prerequisites the user already has lessons for
    user_lesson_titles = [
        l.title.lower() for l in
        db.query(LessonModel.title).filter(LessonModel.user_id == current_user.id).all()
    ]
    covered = [p for p in prerequisites if any(p.lower() in title for title in user_lesson_titles)]
    missing  = [p for p in prerequisites if p not in covered]

    return {
        "primary_concepts": concepts.get('primary_concepts', []),
        "prerequisites": prerequisites,
        "difficulty_context": concepts.get('difficulty_context', ''),
        "covered_prerequisites": covered,
        "missing_prerequisites": missing,
    }


@app.get("/api/analytics/dashboard")
async def get_analytics_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregate learning analytics for the dashboard.
    This is the primary Pro tier conversion hook — free users see the gap,
    Pro users see the recommendations.
    """
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    # ── Core stats ────────────────────────────────────────────────
    total_lessons = db.query(LessonModel).filter(
        LessonModel.user_id == current_user.id
    ).count()

    lessons_this_week = db.query(LessonModel).filter(
        LessonModel.user_id == current_user.id,
        LessonModel.created_at >= week_ago,
    ).count()

    total_cards = db.query(ReviewCard).filter(
        ReviewCard.user_id == current_user.id
    ).count()

    due_today = db.query(ReviewCard).filter(
        ReviewCard.user_id == current_user.id,
        ReviewCard.due_date <= now,
        ReviewCard.is_suspended == False,
    ).count()

    total_reviews = db.query(ReviewLog).filter(
        ReviewLog.user_id == current_user.id
    ).count()

    reviews_this_week_all = db.query(ReviewLog).filter(
        ReviewLog.user_id == current_user.id,
        ReviewLog.reviewed_at >= week_ago,
    ).all()

    reviews_this_week = len(reviews_this_week_all)
    correct_this_week = sum(1 for r in reviews_this_week_all if r.rating >= 3)
    accuracy_this_week = (correct_this_week / reviews_this_week) if reviews_this_week > 0 else 0.0

    avg_easiness_row = db.query(func.avg(ReviewCard.easiness_factor)).filter(
        ReviewCard.user_id == current_user.id
    ).scalar()
    avg_easiness = float(avg_easiness_row) if avg_easiness_row else 2.5

    # ── Streak: consecutive days with at least one review ─────────
    all_review_dates = sorted(set(
        r.reviewed_at.date()
        for r in db.query(ReviewLog).filter(ReviewLog.user_id == current_user.id).all()
    ), reverse=True)

    streak_days = 0
    if all_review_dates:
        from datetime import date, timedelta as td
        check = date.today()
        for d in all_review_dates:
            if d == check or d == check - td(days=1):
                streak_days += 1
                check = d
            else:
                break

    # ── 7-day activity (one entry per day) ────────────────────────
    activity = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_reviews = [r for r in reviews_this_week_all if r.reviewed_at.date() == day]
        activity.append({
            "date": str(day),
            "reviews": len(day_reviews),
            "correct": sum(1 for r in day_reviews if r.rating >= 3),
        })

    # ── Recent lessons (last 10) ──────────────────────────────────
    recent = db.query(LessonModel).filter(
        LessonModel.user_id == current_user.id
    ).order_by(LessonModel.created_at.desc()).limit(10).all()

    recent_lessons = []
    for lesson in recent:
        progress = db.query(UserProgress).filter(
            UserProgress.lesson_id == lesson.id,
            UserProgress.user_id == current_user.id,
        ).first()
        recent_lessons.append({
            "id": str(lesson.id),
            "title": lesson.title,
            "difficulty": lesson.difficulty or "beginner",
            "created_at": lesson.created_at.isoformat(),
            "validation_status": lesson.validation_status,
            "is_completed": progress.is_completed if progress else False,
        })

    # ── Concept mastery (top 8 by review volume) ─────────────────
    # Proxy: use lessons with concepts_json + their linked review cards
    concept_scores: dict = {}
    lessons_with_concepts = db.query(LessonModel).filter(
        LessonModel.user_id == current_user.id,
        LessonModel.concepts_json.isnot(None),
    ).all()

    for lesson in lessons_with_concepts:
        card = db.query(ReviewCard).filter(
            ReviewCard.lesson_id == lesson.id,
            ReviewCard.user_id == current_user.id,
        ).first()
        if not card:
            continue
        ef = float(card.easiness_factor)
        # Normalize EF (1.3 = 0%, 3.0 = 100%) to mastery score
        mastery = max(0.0, min(1.0, (ef - 1.3) / 1.7))
        logs = db.query(ReviewLog).filter(ReviewLog.card_id == card.id).count()

        for concept in (lesson.concepts_json or {}).get('primary_concepts', []):
            if concept not in concept_scores:
                concept_scores[concept] = {"mastery_sum": 0, "count": 0, "reviews": 0}
            concept_scores[concept]["mastery_sum"] += mastery
            concept_scores[concept]["count"] += 1
            concept_scores[concept]["reviews"] += logs

    top_concepts = sorted([
        {
            "name": name,
            "mastery": round(v["mastery_sum"] / v["count"], 3),
            "reviews": v["reviews"],
        }
        for name, v in concept_scores.items()
    ], key=lambda x: x["reviews"], reverse=True)[:8]

    return {
        "status": "success",
        "stats": {
            "lessons_this_week": lessons_this_week,
            "total_lessons": total_lessons,
            "total_cards": total_cards,
            "due_today": due_today,
            "streak_days": streak_days,
            "total_reviews": total_reviews,
            "reviews_this_week": reviews_this_week,
            "accuracy_this_week": round(accuracy_this_week, 3),
            "avg_easiness": round(avg_easiness, 2),
        },
        "activity": activity,
        "top_concepts": top_concepts,
        "recent_lessons": recent_lessons,
    }


# ===== HEALTH & INFO =====

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    db_ok = check_db_health()
    generator_status = "ready" if lesson_generator else "unavailable"
    
    return {
        "status": "online" if db_ok else "degraded",
        "message": "VibeCode Engine Phase 3",
        "database": "connected" if db_ok else "disconnected",
        "lesson_generator": generator_status
    }


@app.get("/api/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "created_at": current_user.created_at.isoformat(),
        "is_active": current_user.is_active,
    }




# ===== SPACED REPETITION ENDPOINTS =====

class ReviewRatingRequest(BaseModel):
    card_id: str
    rating: int = Field(..., ge=1, le=4, description="1=Again 2=Hard 3=Good 4=Easy")


@app.post("/api/lessons/{lesson_id}/enqueue")
async def enqueue_lesson_for_review(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a review card for a lesson (called automatically after lesson completion).
    Idempotent — safe to call multiple times.
    """
    lesson = db.query(LessonModel).filter(
        LessonModel.id == lesson_id,
        LessonModel.user_id == current_user.id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    existing = db.query(ReviewCard).filter(
        ReviewCard.user_id == current_user.id,
        ReviewCard.lesson_id == lesson_id
    ).first()
    if existing:
        return {"status": "exists", "card_id": str(existing.id)}

    card = ReviewCard(user_id=current_user.id, lesson_id=lesson_id)
    db.add(card)
    db.commit()
    db.refresh(card)
    logger.info(f"📇 Review card created for lesson {lesson_id}")
    return {"status": "created", "card_id": str(card.id)}


@app.get("/api/review/due")
async def get_due_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return cards due for review today, ordered by urgency (most overdue first).
    """
    now = datetime.utcnow()
    cards = (
        db.query(ReviewCard, LessonModel)
        .join(LessonModel, ReviewCard.lesson_id == LessonModel.id)
        .filter(
            ReviewCard.user_id == current_user.id,
            ReviewCard.due_date <= now,
            ReviewCard.is_suspended == False,
        )
        .order_by(ReviewCard.due_date.asc())
        .all()
    )

    return {
        "status": "success",
        "due_count": len(cards),
        "cards": [
            {
                "card_id": str(card.id),
                "lesson_id": str(card.lesson_id),
                "lesson_title": lesson.title,
                "lesson_description": lesson.description,
                "lesson_difficulty": lesson.difficulty,
                "interval_days": card.interval_days,
                "repetitions": card.repetitions,
                "days_overdue": max(0, (now - card.due_date).days),
            }
            for card, lesson in cards
        ],
    }


@app.post("/api/review/complete")
async def complete_review(
    body: ReviewRatingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a review rating. Applies SM-2 algorithm, schedules next review.

    Rating meanings:
      1 = Again  — complete blackout, see again in 1 day
      2 = Hard   — wrong but close, short interval
      3 = Good   — correct, normal interval
      4 = Easy   — effortless recall, longer interval
    """
    card = db.query(ReviewCard).filter(
        ReviewCard.id == body.card_id,
        ReviewCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Snapshot state before update (for review log)
    interval_before = card.interval_days
    ef_before = float(card.easiness_factor)

    # Apply SM-2
    state = CardState(
        easiness_factor=float(card.easiness_factor),
        interval_days=card.interval_days,
        repetitions=card.repetitions,
        due_date=card.due_date,
    )
    updated = sm2_schedule(state, body.rating)

    card.easiness_factor = updated.easiness_factor
    card.interval_days = updated.interval_days
    card.repetitions = updated.repetitions
    card.due_date = updated.due_date
    card.last_reviewed_at = updated.last_reviewed_at

    # Write immutable review log
    log = ReviewLog(
        card_id=card.id,
        user_id=current_user.id,
        rating=body.rating,
        interval_before=interval_before,
        easiness_before=ef_before,
    )
    db.add(log)
    db.commit()

    logger.info(f"✅ Review complete: rating={body.rating} next_review={card.due_date.date()}")
    return {
        "status": "success",
        "next_review_in_days": card.interval_days,
        "next_review_date": card.due_date.isoformat(),
        "repetitions": card.repetitions,
        "easiness_factor": float(card.easiness_factor),
    }


@app.get("/api/review/stats")
async def get_review_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Aggregate review statistics for the current user."""
    now = datetime.utcnow()
    total_cards = db.query(ReviewCard).filter(ReviewCard.user_id == current_user.id).count()
    due_today = db.query(ReviewCard).filter(
        ReviewCard.user_id == current_user.id,
        ReviewCard.due_date <= now,
        ReviewCard.is_suspended == False,
    ).count()
    total_reviews = db.query(ReviewLog).filter(ReviewLog.user_id == current_user.id).count()

    # Reviews in last 7 days
    week_ago = now - timedelta(days=7)
    reviews_this_week = db.query(ReviewLog).filter(
        ReviewLog.user_id == current_user.id,
        ReviewLog.reviewed_at >= week_ago,
    ).count()

    return {
        "status": "success",
        "total_cards": total_cards,
        "due_today": due_today,
        "total_reviews": total_reviews,
        "reviews_this_week": reviews_this_week,
    }


# ===== MISCONCEPTION MICRO-LESSON ENDPOINT =====

class MisconceptionRequest(BaseModel):
    question: str
    wrong_answer: str
    correct_answer: str
    lesson_context: str = ""


@app.post("/api/misconception")
async def generate_misconception_lesson(body: MisconceptionRequest):
    """
    Generate a 60-second micro-lesson explaining why a quiz answer was wrong.

    Called automatically by MisconceptionModal.tsx when a user answers incorrectly.
    No authentication required — friction here reduces engagement.

    Returns:
        micro_lesson: { why_it_seemed_right, correct_mental_model, analogy }
    """
    if not lesson_generator:
        raise HTTPException(
            status_code=503,
            detail="Lesson generation service unavailable. Set GEMINI_API_KEY."
        )

    try:
        micro = lesson_generator.generate_misconception_explanation(
            question=body.question,
            wrong_answer=body.wrong_answer,
            correct_answer=body.correct_answer,
            lesson_context=body.lesson_context,
        )
        return {"status": "success", "micro_lesson": micro}
    except Exception as e:
        logger.error(f"❌ Misconception generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate explanation.")


# ===== CODE EXECUTION ENDPOINT =====

class ExecuteRequest(BaseModel):
    code: str = Field(..., max_length=10_000)
    language: str = Field(default="python", description="python | javascript")


@app.post("/api/execute")
async def execute_code(body: ExecuteRequest):
    """
    Server-side code execution safety valve.
    For Python: frontend uses Pyodide (no server call needed).
    For JS: frontend uses sandboxed iframe (no server call needed).
    This endpoint exists as a fallback for languages Pyodide doesn't support
    and as the future Judge0 proxy when multi-language support is added.

    Current implementation: returns a clear message directing client to
    use the in-browser runners (Pyodide/iframe) which are already wired
    in CodeRunner.tsx.
    """
    lang = body.language.lower()
    if lang in ("python", "javascript", "js", "typescript", "ts"):
        # These run client-side — the frontend CodeRunner component handles them.
        # This endpoint should not be called for these languages.
        return {
            "status": "client_side",
            "message": f"{body.language} execution is handled client-side via Pyodide/iframe. No server round-trip needed.",
        }

    # Future: proxy to self-hosted Judge0 for other languages (Go, Rust, Java, etc.)
    raise HTTPException(
        status_code=501,
        detail=f"Server-side execution for '{body.language}' not yet available. Coming in Phase 5."
    )


if __name__ == "__main__":
    print("🚀 Starting VibeCode Engine Phase 3 on http://0.0.0.0:8000")
    print("📖 API docs available at http://localhost:8000/docs")
    print("🗄️ Database: PostgreSQL")
    print("🔐 Authentication: JWT + Bcrypt")
    print("📚 Lesson generation enabled:", "Yes" if lesson_generator else "No (set GEMINI_API_KEY)")
    
    # Initialize database on startup
    try:
        init_db()
    except Exception as e:
        logger.warning(f"⚠️ Could not initialize database: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
