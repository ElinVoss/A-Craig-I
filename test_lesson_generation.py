#!/usr/bin/env python3
"""
Test script for the VibeCode lesson generation pipeline.
Run this after setting your GEMINI_API_KEY to verify everything works.
"""

import sys
import json
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from lesson_generator import LessonGenerator


def test_lesson_generation():
    """Test lesson generation with a simple example."""
    
    print("🧪 Testing VibeCode Lesson Generation Pipeline")
    print("=" * 60)
    
    # Check for API key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ ERROR: GEMINI_API_KEY not set")
        print("Set it with: export GEMINI_API_KEY=your_key_here")
        return False
    
    print("✅ GEMINI_API_KEY found")
    
    # Initialize generator
    try:
        print("\n🔄 Initializing lesson generator...")
        generator = LessonGenerator(api_key=api_key)
        print("✅ Lesson generator initialized")
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        return False
    
    # Test code example
    test_code = """def hello_world():
    '''A simple greeting function.'''
    print("Hello, World!")

hello_world()"""
    
    test_context = "Write a simple Python function that prints 'Hello, World!'"
    test_url = "https://claude.ai/chat/test"
    
    # Generate lesson
    try:
        print("\n📚 Generating lesson...")
        print(f"   Code: {len(test_code)} chars")
        print(f"   Context: {test_context}")
        
        lesson_wrapper = generator.generate_lesson(
            code=test_code,
            context=test_context,
            url=test_url,
            source_model="Test Model",
            difficulty="beginner"
        )
        
        print("✅ Lesson generated successfully!")
        
        # Validate structure
        lesson = lesson_wrapper.lesson
        print(f"\n📖 Lesson Details:")
        print(f"   Title: {lesson.title}")
        print(f"   Difficulty: {lesson.difficulty}")
        print(f"   Estimated Time: {lesson.estimatedTime}")
        print(f"   Steps: {len(lesson.steps)}")
        print(f"   Learning Objectives: {len(lesson.learningObjectives)}")
        
        # Validate each step
        for step in lesson.steps:
            print(f"\n   Step {step.order}: {step.title}")
            print(f"      Type: {step.type}")
            if step.quiz:
                print(f"      ✓ Has quiz with {len(step.quiz.options)} options")
            if step.exercise:
                print(f"      ✓ Has exercise with {len(step.exercise.blanks)} blanks")
            if step.content.dataJourney:
                print(f"      ✓ Has data journey with {len(step.content.dataJourney)} stages")
        
        # Save to file
        output_file = Path(__file__).parent / "generated_lesson.json"
        with open(output_file, "w") as f:
            json.dump(lesson_wrapper.model_dump(), f, indent=2)
        
        print(f"\n✅ Lesson saved to {output_file}")
        print("\n🎉 All tests passed! Ready to use VibeCode.")
        return True
        
    except Exception as e:
        print(f"❌ Failed to generate lesson: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_lesson_generation()
    sys.exit(0 if success else 1)
