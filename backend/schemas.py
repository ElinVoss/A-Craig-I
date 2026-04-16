"""
Pydantic schemas that mirror the React TypeScript interfaces.
These models ensure strict type safety and enable structured outputs from Gemini.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class QuizOption(BaseModel):
    """A single answer option in a quiz."""
    id: str = Field(..., description="Unique identifier (a, b, c, d)")
    text: str = Field(..., description="The answer text displayed to user")
    correct: bool = Field(..., description="Whether this is the correct answer")
    explanation: str = Field(..., description="Explanation shown after answer")


class Quiz(BaseModel):
    """A quiz block with multiple-choice questions."""
    question: str = Field(..., description="The quiz question")
    options: List[QuizOption] = Field(..., min_items=3, max_items=4, description="Answer options")


class CodeHighlight(BaseModel):
    """Code snippet with syntax highlighting metadata."""
    language: str = Field(..., description="Programming language (python, javascript, etc.)")
    snippet: str = Field(..., description="The actual code snippet")


class ModelField(BaseModel):
    """A field in a Pydantic data model."""
    name: str = Field(..., description="Field name (e.g., 'code', 'context')")
    type: str = Field(..., description="Type annotation (e.g., 'str', 'Optional[str]')")
    required: bool = Field(..., description="Whether field is required")
    description: str = Field(..., description="What this field represents")
    example: Optional[str] = Field(None, description="Example value")
    default: Optional[str] = Field(None, description="Default value if optional")


class ModelBreakdown(BaseModel):
    """Breakdown of a Pydantic model structure."""
    name: str = Field(..., description="Model class name")
    description: str = Field(..., description="What this model does")
    fields: List[ModelField] = Field(..., description="Field definitions")


class BlankExercise(BaseModel):
    """A single fill-in-the-blank question."""
    id: str = Field(..., description="Unique blank ID")
    position: str = Field(..., description="Location in code (e.g., 'line 2, after colon')")
    answer: str = Field(..., description="The correct answer")
    hint: str = Field(..., description="Hint to help user")
    options: List[str] = Field(..., min_items=3, max_items=4, description="Multiple choice options")


class FillInTheBlanksExercise(BaseModel):
    """A fill-in-the-blanks coding exercise."""
    type: str = Field(default="fillInTheBlank", description="Exercise type")
    title: str = Field(..., description="Exercise title")
    description: str = Field(..., description="What the user needs to do")
    given: dict = Field(..., description="Code with blanks (code, language keys)")
    blanks: List[BlankExercise] = Field(..., description="Blank definitions")


class DataJourneyStage(BaseModel):
    """A single stage in the data journey visualization."""
    stage: int = Field(..., description="Stage number (0-4)")
    location: str = Field(..., description="Where in the stack (e.g., '🌐 User Browser')")
    actor: str = Field(..., description="Component responsible (e.g., 'popup.js')")
    action: str = Field(..., description="What's happening in this stage")
    code: str = Field(..., description="Relevant code snippet")
    output: Optional[dict] = Field(None, description="Data output at this stage")


class TimelineSegment(BaseModel):
    """A segment of the request/response timeline."""
    phase: str = Field(..., description="Phase name (e.g., 'Phase 1: Extraction')")
    duration: str = Field(..., description="How long this takes (e.g., '~100ms')")
    description: str = Field(..., description="What happens in this phase")


class Timeline(BaseModel):
    """Timeline breakdown of the data flow."""
    title: str = Field(..., description="Timeline title")
    segments: List[TimelineSegment] = Field(..., description="Timeline segments")


class StepContent(BaseModel):
    """Content for a lesson step."""
    headline: str = Field(..., description="Main headline for this step")
    explanation: Optional[str] = Field(None, description="Detailed explanation")
    scenario: Optional[str] = Field(None, description="Real-world scenario")
    solution: Optional[str] = Field(None, description="Solution or explanation")
    keyTakeaway: Optional[str] = Field(None, description="Key learning point")
    codeHighlight: Optional[CodeHighlight] = Field(None, description="Code to display")
    modelBreakdown: Optional[ModelBreakdown] = Field(None, description="Data model breakdown")
    dataJourney: Optional[List[DataJourneyStage]] = Field(None, description="Data flow stages")
    timeline: Optional[Timeline] = Field(None, description="Timeline breakdown")


class LessonStep(BaseModel):
    """A single step in the lesson."""
    id: str = Field(..., description="Unique step ID (step_1, step_2, etc.)")
    title: str = Field(..., description="Step title with emoji")
    order: int = Field(..., description="Order in sequence")
    type: str = Field(..., description="Step type: concept, exercise, or visualization")
    content: StepContent = Field(..., description="Step content")
    quiz: Optional[Quiz] = Field(None, description="Quiz for concept steps")
    exercise: Optional[FillInTheBlanksExercise] = Field(None, description="Exercise for exercise steps")
    keyPoints: Optional[List[str]] = Field(None, description="Key bullet points")


class Metadata(BaseModel):
    """Metadata about the lesson."""
    createdAt: str = Field(..., description="ISO 8601 timestamp")
    version: str = Field(default="1.0.0", description="Schema version")
    author: str = Field(default="VibeCode Teacher Engine", description="Lesson creator")
    tags: List[str] = Field(..., description="Tags for categorization")


class LessonSummary(BaseModel):
    """Summary section at end of lesson."""
    title: str = Field(..., description="Section title")
    recap: List[str] = Field(..., description="Recap points")
    nextPhase: Optional[str] = Field(None, description="Next phase name")
    nextPhaseDescription: Optional[str] = Field(None, description="What comes next")
    actionItems: Optional[List[dict]] = Field(None, description="Follow-up tasks")


class Lesson(BaseModel):
    """Complete lesson structure (matches React TypeScript interface)."""
    title: str = Field(..., description="Lesson title")
    description: str = Field(..., description="1-2 sentence description")
    difficulty: str = Field(..., description="Difficulty level: beginner, intermediate, advanced")
    estimatedTime: str = Field(..., description="Time estimate (e.g., '15 minutes')")
    learningObjectives: List[str] = Field(..., min_items=2, max_items=5, description="Learning goals")
    steps: List[LessonStep] = Field(..., min_items=3, max_items=5, description="Lesson steps")
    summary: LessonSummary = Field(..., description="Summary section")
    metadata: Metadata = Field(..., description="Metadata")


class LessonWrapper(BaseModel):
    """Wrapper to match our lesson.json structure."""
    lesson: Lesson = Field(..., description="The lesson object")
