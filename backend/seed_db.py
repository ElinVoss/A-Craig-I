"""
Seed development database with sample users and lessons.
Run: python seed_db.py
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import User, Lesson, UserProgress, RefreshToken
from database import get_db_context
from auth import hash_password, create_token_pair, hash_token
import json

# Sample lesson data
SAMPLE_LESSON = {
    "title": "Understanding FastAPI Routes",
    "description": "Learn how FastAPI handles HTTP routing with decorators",
    "difficulty": "beginner",
    "learningObjectives": [
        "Understand the @app.get() decorator",
        "Learn path parameters vs query parameters",
        "Know how to return JSON responses"
    ],
    "steps": [
        {
            "title": "The Hook: Why Decorators?",
            "type": "concept",
            "content": "FastAPI uses Python decorators to map URLs to functions...",
            "quiz": {
                "question": "What does @app.get('/users') do?",
                "options": [
                    "Creates a route that responds to GET requests",
                    "Deletes all users",
                    "Fetches data from a database"
                ],
                "correctAnswer": 0
            }
        },
        {
            "title": "Path vs Query Parameters",
            "type": "exercise",
            "content": "Fill in the blanks to create routes...",
            "blanks": [
                {"text": "@app.get('/{user_id}')", "answer": "user_id"},
                {"text": "async def get_user(___): return {...}", "answer": "user_id: int"}
            ]
        },
        {
            "title": "Data Journey",
            "type": "visualization",
            "content": "Browser → FastAPI → JSON Response"
        }
    ]
}


def seed_database():
    """Create sample users and lessons."""
    with get_db_context() as db:
        print("🌱 Seeding database...")
        
        # Create sample users
        users = [
            User(
                email="alice@example.com",
                username="alice",
                password_hash=hash_password("AlicePass123"),
                is_active=True
            ),
            User(
                email="bob@example.com",
                username="bob",
                password_hash=hash_password("BobPass123"),
                is_active=True
            ),
        ]
        
        for user in users:
            # Check if already exists
            existing = db.query(User).filter(User.email == user.email).first()
            if not existing:
                db.add(user)
                print(f"  ✅ Created user: {user.email}")
            else:
                user = existing
                print(f"  ℹ️  User exists: {user.email}")
        
        db.commit()
        
        # Refresh to get IDs
        for user in users:
            db.refresh(user)
        
        # Create sample lessons for alice
        alice = users[0]
        for i in range(3):
            lesson = Lesson(
                user_id=alice.id,
                title=f"Lesson {i+1}: {SAMPLE_LESSON['title']}",
                description=SAMPLE_LESSON['description'],
                difficulty=SAMPLE_LESSON['difficulty'],
                lesson_json=SAMPLE_LESSON,
                source_code="# Sample code",
                source_url="https://example.com",
                is_public=(i == 0),  # First one is public
            )
            
            existing_lesson = db.query(Lesson).filter(
                Lesson.user_id == alice.id,
                Lesson.title == lesson.title
            ).first()
            
            if not existing_lesson:
                db.add(lesson)
                print(f"  ✅ Created lesson: {lesson.title}")
            
        db.commit()
        
        # Create progress for alice's first lesson
        alice_lessons = db.query(Lesson).filter(Lesson.user_id == alice.id).all()
        if alice_lessons:
            first_lesson = alice_lessons[0]
            existing_progress = db.query(UserProgress).filter(
                UserProgress.user_id == alice.id,
                UserProgress.lesson_id == first_lesson.id
            ).first()
            
            if not existing_progress:
                progress = UserProgress(
                    user_id=alice.id,
                    lesson_id=first_lesson.id,
                    current_step=1,
                    completion_percentage=50,
                    quiz_scores={"step_0": 100},
                    exercise_scores={"step_1_blank_0": True}
                )
                db.add(progress)
                db.commit()
                print(f"  ✅ Created progress for lesson: {first_lesson.title}")
        
        print("\n✨ Database seeded successfully!")
        print(f"   Users: 2 (alice@example.com, bob@example.com)")
        print(f"   Lessons: 3 (in alice's library)")
        print(f"   Progress: 1 (50% complete)")


if __name__ == "__main__":
    try:
        seed_database()
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
