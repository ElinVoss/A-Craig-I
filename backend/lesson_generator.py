"""
Lesson generation engine powered by Gemini's structured outputs.
Converts raw code + context into interactive lessons.
"""

import google.generativeai as genai
import json
from datetime import datetime
from typing import Optional
from .schemas import Lesson, LessonWrapper
import os


class LessonGenerator:
    """Generates interactive lessons from code snippets using Gemini."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the lesson generator.
        
        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY not provided and not found in environment. "
                "Set it via parameter or env variable."
            )
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    def generate_lesson(
        self,
        code: str,
        context: str,
        url: str,
        source_model: Optional[str] = "Unknown",
        difficulty: str = "beginner",
    ) -> LessonWrapper:
        """
        Generate a complete lesson from code and context.
        
        Args:
            code: The source code to teach
            context: The conversational context/prompt that generated the code
            url: The source URL (for metadata)
            source_model: The AI model that generated the code
            difficulty: Target difficulty level
            
        Returns:
            A LessonWrapper containing a fully structured Lesson
        """
        
        # Build the prompt
        system_prompt = """You are the VibeCode Teacher Engine. Your job is to take raw code from an AI chat and deconstruct it into an interactive, 3-step lesson for a beginner programmer.

The lesson MUST have exactly 3 steps:
1. **Concept Step** (Hook): Explain the "why" and core concept. Include a quiz with 4 options where only 1 is correct.
2. **Exercise Step** (Logic): Deep-dive into data structures or functions. Include a fill-in-the-blank exercise with 4 blanks, each with 3-4 options.
3. **Visualization Step** (Flow): Show how data flows or how the code executes. Include a 5-stage data journey with timelines.

CRITICAL REQUIREMENTS:
- Make the lesson RELATABLE: Use real-world metaphors and scenarios
- Include EMOJI in step titles (🔗, 🧩, 🌊, etc.)
- Each quiz option MUST include a detailed explanation
- Each blank exercise MUST have clear hints
- The data journey MUST show actual code snippets and data transformations at each stage
- Timelines MUST include realistic durations (~100ms, ~50ms, etc.)
- All steps MUST build on each other logically
- Use the exact field names from the Lesson schema (no typos!)

Return ONLY a valid JSON object matching the Lesson schema. No markdown, no explanations, just JSON."""

        user_prompt = f"""Generate a beginner-friendly, 3-step interactive lesson for this code:

CODE:
```
{code}
```

CONTEXT (what the user asked for):
{context}

SOURCE: {source_model} ({url})
DIFFICULTY: {difficulty}

Remember: Exactly 3 steps, with quiz/exercise/visualization. Follow the schema precisely."""

        # Call Gemini with structured output
        try:
            response = self.model.generate_content(
                [
                    {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8000,
                ),
            )
            
            # Extract the response text
            response_text = response.text.strip()
            
            # Parse the JSON response
            try:
                lesson_dict = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code blocks
                if "```json" in response_text:
                    json_str = response_text.split("```json")[1].split("```")[0].strip()
                    lesson_dict = json.loads(json_str)
                elif "```" in response_text:
                    json_str = response_text.split("```")[1].split("```")[0].strip()
                    lesson_dict = json.loads(json_str)
                else:
                    raise ValueError(f"Could not parse JSON from response: {response_text[:500]}")
            
            # Validate against schema and wrap
            if "lesson" not in lesson_dict:
                # If the response is just the Lesson object, wrap it
                lesson_dict = {"lesson": lesson_dict}
            
            # Validate with Pydantic
            lesson_wrapper = LessonWrapper(**lesson_dict)
            
            return lesson_wrapper
            
        except Exception as e:
            raise ValueError(f"Failed to generate lesson: {str(e)}")

    def generate_lesson_structured(
        self,
        code: str,
        context: str,
        url: str,
        source_model: Optional[str] = "Unknown",
        difficulty: str = "beginner",
    ) -> dict:
        """
        Generate a lesson and return as a dictionary (for JSON serialization).
        
        Args:
            code: The source code to teach
            context: The conversational context
            url: The source URL
            source_model: The AI model name
            difficulty: Target difficulty level
            
        Returns:
            Dictionary representation of the lesson (JSON-serializable)
        """
        wrapper = self.generate_lesson(code, context, url, source_model, difficulty)
        return wrapper.model_dump()
