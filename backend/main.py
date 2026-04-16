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
from models import User, Lesson as LessonModel, UserProgress, LessonRating, RefreshToken
from auth import (
    hash_password, verify_password, 
    create_token_pair, decode_access_token, decode_refresh_token,
    hash_token, verify_token_hash,
    validate_password_strength, TokenResponse, REFRESH_TOKEN_EXPIRE_DAYS
)

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
        
        # Generate lesson
        lesson_data = lesson_generator.generate_lesson_structured(
            code=request.code,
            context=request.context,
            url=request.url,
            source_model=request.source_model,
            difficulty=request.difficulty,
        )
        
        # Save to database
        db_lesson = LessonModel(
            user_id=current_user.id,
            title=lesson_data.title,
            description=lesson_data.description,
            difficulty=lesson_data.difficulty,
            lesson_json=lesson_data.dict(),
            source_code=request.code,
            source_url=request.url,
        )
        
        db.add(db_lesson)
        db.commit()
        db.refresh(db_lesson)
        
        logger.info(f"✅ Lesson saved: {db_lesson.id}")
        
        return {
            "status": "success",
            "message": "Lesson generated and saved",
            "lesson_id": str(db_lesson.id),
            "data": lesson_data.dict()
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
