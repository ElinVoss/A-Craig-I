from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging
from lesson_generator import LessonGenerator
from schemas import Lesson

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VibeCode Engine", version="1.0.0")

# Allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the lesson generator
try:
    lesson_generator = LessonGenerator()
    logger.info("✅ Lesson generator initialized with Gemini API")
except ValueError as e:
    logger.warning(f"⚠️ Lesson generator not available: {e}")
    lesson_generator = None


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


@app.post("/ingest")
async def ingest_conversation(data: CodeIngestion):
    """Ingest code and context from AI chat interfaces."""
    print(f"📥 Received code from: {data.url}")
    print(f"📝 Context preview: {data.context[:100]}...")
    print(f"💾 Code length: {len(data.code)} characters")
    
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
    Generate an interactive lesson from code.
    
    Uses Gemini's structured outputs to ensure the response matches
    our Lesson schema exactly. The returned lesson can be directly
    rendered by the React frontend.
    """
    if not lesson_generator:
        raise HTTPException(
            status_code=503,
            detail="Lesson generation service unavailable. Set GEMINI_API_KEY environment variable."
        )
    
    try:
        logger.info(f"🔄 Generating lesson for code from: {request.url}")
        
        # Generate the lesson
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
            "data": lesson_data,  # This is the Lesson object wrapped as LessonWrapper
        }
        
    except Exception as e:
        logger.error(f"❌ Lesson generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate lesson: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    generator_status = "ready" if lesson_generator else "unavailable"
    return {
        "status": "online",
        "message": "VibeCode Engine running",
        "lesson_generator": generator_status
    }


if __name__ == "__main__":
    print("🚀 Starting VibeCode Engine on http://0.0.0.0:8000")
    print("📖 API docs available at http://localhost:8000/docs")
    print("📚 Lesson generation enabled:", "Yes" if lesson_generator else "No (set GEMINI_API_KEY)")
    uvicorn.run(app, host="0.0.0.0", port=8000)
