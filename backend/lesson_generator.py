"""
Lesson generation engine powered by Gemini's structured outputs.
Converts raw code + context into interactive lessons.
"""

import google.generativeai as genai  # legacy SDK — will be migrated to google.genai in Phase 7
import json
from datetime import datetime
from typing import Optional
from schemas import Lesson, LessonWrapper
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

    def _parse_json(self, text: str) -> dict:
        """Strip markdown fences and parse JSON response from Gemini."""
        text = text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)

    def generate_lesson(
        self,
        code: str,
        context: str,
        url: str,
        source_model: Optional[str] = "Unknown",
        difficulty: str = "beginner",
        depth_level: str = "beginner",
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
        
        # Depth level → explanation style instructions
        DEPTH_INSTRUCTIONS = {
            'eli5':         'Use simple analogies and zero jargon. Explain everything like the reader has never programmed before. Use metaphors from everyday life (cooking, driving, etc.).',
            'beginner':     'Plain English, step by step. Assume the reader knows what variables and functions are, but nothing else. Avoid acronyms without explanation.',
            'intermediate': 'Assume solid programming basics. Explain the real mechanics, mention edge cases, time complexity where relevant. Use correct technical terminology.',
            'expert':       'Senior developer audience. Skip fundamentals entirely. Focus on tradeoffs, gotchas, performance implications, and design patterns. Be terse.',
        }
        depth_instruction = DEPTH_INSTRUCTIONS.get(depth_level, DEPTH_INSTRUCTIONS['beginner'])

        # Build the prompt
        system_prompt = f"""You are the VibeCode Teacher Engine. Your job is to take raw code from an AI chat and deconstruct it into an interactive, 3-step lesson.

EXPLANATION STYLE: {depth_instruction}

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

        user_prompt = f"""Generate a {depth_level}-level, 3-step interactive lesson for this code:

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
    def generate_lesson_structured(
        self,
        code: str,
        context: str,
        url: str,
        source_model: Optional[str] = "Unknown",
        difficulty: str = "beginner",
        depth_level: str = "beginner",
    ) -> dict:
        """
        Generate a lesson and return as a dictionary (for JSON serialization).
        Passes depth_level through to tailor explanation style.
        """
        wrapper = self.generate_lesson(code, context, url, source_model, difficulty, depth_level)
        return wrapper.model_dump()

    def extract_concepts(self, lesson: dict) -> dict:
        """
        Extract the primary concepts this lesson teaches and what prerequisites it assumes.
        Called after lesson generation; result is cached on the Lesson row.

        Returns:
            {
              primary_concepts: ["concept1", "concept2"],
              prerequisites:    ["prereq1", "prereq2"],
              difficulty_context: "why this difficulty was chosen"
            }
        """
        title = lesson.get('title', '')
        steps = lesson.get('steps', [])
        step_titles = ' · '.join(s.get('title', '') for s in steps)

        prompt = f"""Analyze this lesson and extract key programming concepts.

LESSON TITLE: {title}
STEP TITLES: {step_titles}

Respond with ONLY valid JSON (no markdown):
{{
  "primary_concepts": ["2-4 specific concepts THIS lesson teaches"],
  "prerequisites": ["0-3 concepts a student should know BEFORE this lesson"],
  "difficulty_context": "one sentence: why this difficulty level is appropriate"
}}"""

        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.2, max_output_tokens=256),
        )
        return self._parse_json(response.text)

    def validate_lesson(self, lesson: dict) -> dict:
        """
        Second LLM pass: checks lesson quality, factual accuracy, and code correctness.
        Prevents AI hallucinations from becoming learned facts.

        Returns:
            {
              status: "pass" | "warn" | "fail",
              issues: ["issue1"],
              confidence: 0.0-1.0
            }
        """
        steps = lesson.get('steps', [])
        code_blocks = []
        explanations = []
        for step in steps:
            content = step.get('content', {})
            highlight = content.get('codeHighlight') or {}
            if highlight.get('snippet'):
                code_blocks.append(f"[{highlight.get('language','?')}]\n{highlight['snippet'][:400]}")
            if content.get('explanation'):
                explanations.append(content['explanation'][:200])

        prompt = f"""You are a technical editor. Review this programming lesson for quality issues.

LESSON TITLE: {lesson.get('title', '')}
DIFFICULTY: {lesson.get('difficulty', '')}

CODE BLOCKS:
{chr(10).join(code_blocks) if code_blocks else "(no code blocks)"}

KEY EXPLANATIONS:
{chr(10).join(explanations) if explanations else "(no explanations)"}

Check: (1) Does the code match what the explanation says? (2) Any factual errors?
(3) Is the explanation appropriate for the stated difficulty? (4) Any contradictions?

Respond with ONLY valid JSON (no markdown):
{{
  "status": "pass",
  "issues": [],
  "confidence": 0.9
}}"""

        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.1, max_output_tokens=256),
        )
        return self._parse_json(response.text)

    def generate_misconception_explanation(
        self,
        question: str,
        wrong_answer: str,
        correct_answer: str,
        lesson_context: str = "",
    ) -> dict:
        """
        Generate a compassionate micro-lesson explaining why a wrong quiz answer was wrong.

        Returns a dict with three keys:
            why_it_seemed_right   — validates the confusion (1-2 sentences)
            correct_mental_model  — explains the right concept clearly (2-3 sentences)
            analogy               — memorable real-world analogy (1 sentence)
        """
        prompt = f"""A student answered a quiz question incorrectly. Generate a compassionate,
concise micro-lesson (< 80 words total) that helps them understand their mistake.

QUESTION: {question}
STUDENT'S ANSWER (wrong): {wrong_answer}
CORRECT ANSWER: {correct_answer}
LESSON CONTEXT: {lesson_context[:500] if lesson_context else "general programming concept"}

Respond with ONLY valid JSON — no markdown, no wrapper:
{{
  "why_it_seemed_right": "1-2 sentences validating why their wrong answer was a reasonable guess",
  "correct_mental_model": "2-3 sentences explaining the correct concept clearly",
  "analogy": "One memorable real-world analogy that makes the correct answer stick"
}}"""

        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                max_output_tokens=512,
            ),
        )
        return self._parse_json(response.text)

    def generate_lesson_from_github(self, file_url: str, file_content: str) -> LessonWrapper:
        """
        Analyze a real GitHub file and generate a "Reading Code" lesson with 3 steps:
          1. Author's intent (module-level purpose)
          2. Design patterns present
          3. Implicit preconditions / caller contracts
        """
        system_prompt = """You are the VibeCode Teacher Engine. Your job is to analyze real-world
open-source code and generate a "Reading Code" lesson that teaches a developer how to read,
understand, and reason about code they did not write.

The lesson MUST have exactly 3 steps:
1. **What is the author's intent?** — Explain the module-level purpose in plain English.
   Include a quiz with 4 options where only 1 is correct.
2. **What design patterns are present?** — Identify 1-2 patterns (factory, singleton,
   strategy, observer, decorator, etc.) and explain how they appear in this code.
   Include a fill-in-the-blank exercise with 4 blanks, each with 3-4 options.
3. **What does this code assume about its caller?** — Identify preconditions, implicit
   contracts, expected input types, and failure modes.
   Include a 5-stage data journey showing how a realistic call flows through the code.

CRITICAL REQUIREMENTS:
- Make the lesson RELATABLE: Use real-world metaphors and scenarios
- Include EMOJI in step titles (🔍, 🏗️, 📜, etc.)
- Each quiz option MUST include a detailed explanation
- Each blank exercise MUST have clear hints
- The data journey MUST show actual code snippets and data transformations at each stage
- Timelines MUST include realistic durations
- All steps MUST build on each other logically
- Use the exact field names from the Lesson schema (no typos!)

Return ONLY a valid JSON object matching the Lesson schema. No markdown, no explanations, just JSON."""

        user_prompt = f"""Generate a "Reading Code" lesson for this file:

FILE URL: {file_url}

FILE CONTENT:
```
{file_content}
```

Analyze the 3 most interesting/complex functions or classes. Focus on readability,
design intent, and caller contracts. Follow the 3-step structure exactly."""

        try:
            response = self.model.generate_content(
                [{"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8000,
                ),
            )
            response_text = response.text.strip()
            try:
                lesson_dict = json.loads(response_text)
            except json.JSONDecodeError:
                lesson_dict = self._parse_json(response_text)
                if "lesson" not in lesson_dict:
                    lesson_dict = {"lesson": lesson_dict}
            else:
                if "lesson" not in lesson_dict:
                    lesson_dict = {"lesson": lesson_dict}
            return LessonWrapper(**lesson_dict)
        except Exception as e:
            raise ValueError(f"Failed to generate GitHub lesson: {str(e)}")

    def analyze_job_gap(self, user_concepts: list, target_role: str) -> dict:
        """
        Given a list of programming concepts the user knows and a target job role,
        produce a gap analysis report.

        Returns a dict with:
            coverage_percent    — int 0-100
            known_concepts      — subset of user_concepts relevant to the role
            gap_concepts        — list[{name, importance, description, estimated_hours}]
            summary             — 2-sentence assessment
            top_resources       — list[{concept, action}]
        """
        concepts_str = ", ".join(user_concepts) if user_concepts else "(none yet)"
        prompt = f"""You are a senior engineering hiring consultant. A developer wants to become
a "{target_role}". Analyze the gap between what they know and what the role requires.

CONCEPTS THE USER KNOWS: {concepts_str}

Produce a JSON gap analysis. Respond with ONLY valid JSON — no markdown, no wrapper:
{{
  "coverage_percent": <int 0-100>,
  "known_concepts": ["<concepts from user list relevant to the role>"],
  "gap_concepts": [
    {{
      "name": "<concept name>",
      "importance": "critical|important|nice-to-have",
      "description": "<one sentence: why this matters for the role>",
      "estimated_hours": <int hours to learn>
    }}
  ],
  "summary": "<2 sentences: overall assessment of the developer's readiness>",
  "top_resources": [
    {{
      "concept": "<gap concept name>",
      "action": "<e.g. 'Generate a VibeCode lesson on X' or 'Read MDN docs on Y'>"
    }}
  ]
}}

Limit gap_concepts to the 8 most impactful. Limit top_resources to 5."""

        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.3, max_output_tokens=1024),
        )
        return self._parse_json(response.text)
