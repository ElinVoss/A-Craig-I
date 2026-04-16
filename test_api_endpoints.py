#!/usr/bin/env python3
"""
Example usage of the VibeCode API.
Run the backend first: python backend/main.py
Then run this script to generate a lesson.
"""

import requests
import json

# Configuration
BACKEND_URL = "http://localhost:8000"

# Example code to teach
EXAMPLE_CODE = '''def fibonacci(n):
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Usage
for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")'''

EXAMPLE_CONTEXT = "Write a recursive function that generates Fibonacci numbers"
EXAMPLE_URL = "https://claude.ai/chat/example"

def test_ingestion():
    """Test the /ingest endpoint."""
    print("=" * 60)
    print("Testing /ingest endpoint")
    print("=" * 60)
    
    payload = {
        "code": EXAMPLE_CODE,
        "context": EXAMPLE_CONTEXT,
        "url": EXAMPLE_URL,
        "source_model": "Claude 3 Opus"
    }
    
    response = requests.post(
        f"{BACKEND_URL}/ingest",
        json=payload
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()

def test_lesson_generation():
    """Test the /generate-lesson endpoint."""
    print("\n" + "=" * 60)
    print("Testing /generate-lesson endpoint")
    print("=" * 60)
    print("⏳ Generating lesson... (this may take 1-2 seconds)")
    
    payload = {
        "code": EXAMPLE_CODE,
        "context": EXAMPLE_CONTEXT,
        "url": EXAMPLE_URL,
        "source_model": "Claude 3 Opus",
        "difficulty": "beginner"
    }
    
    response = requests.post(
        f"{BACKEND_URL}/generate-lesson",
        json=payload
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Lesson generated successfully!")
        
        # Extract and display lesson info
        lesson = data["data"]["lesson"]
        print(f"\n📚 Lesson Details:")
        print(f"   Title: {lesson['title']}")
        print(f"   Difficulty: {lesson['difficulty']}")
        print(f"   Estimated Time: {lesson['estimatedTime']}")
        print(f"   Steps: {len(lesson['steps'])}")
        
        # Display each step
        print(f"\n📖 Steps:")
        for i, step in enumerate(lesson['steps'], 1):
            print(f"   {i}. {step['title']}")
            print(f"      Type: {step['type']}")
            
        # Save to file
        output_file = "example_generated_lesson.json"
        with open(output_file, "w") as f:
            json.dump(data["data"], f, indent=2)
        
        print(f"\n💾 Full lesson saved to {output_file}")
        
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.json()}")

def test_health():
    """Test the /health endpoint."""
    print("\n" + "=" * 60)
    print("Testing /health endpoint")
    print("=" * 60)
    
    response = requests.get(f"{BACKEND_URL}/health")
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("🧪 VibeCode API Test Suite")
    print("=" * 60 + "\n")
    
    try:
        # Check health first
        test_health()
        
        # Test ingestion
        test_ingestion()
        
        # Generate lesson
        test_lesson_generation()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed!")
        print("=" * 60 + "\n")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to backend")
        print("Make sure the backend is running:")
        print("  python backend/main.py")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
