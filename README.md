# VibeCode — The AI-Era Learning Platform

> **Turn any AI-generated code into an interactive lesson.** Capture from ChatGPT, Claude, Gemini, GitHub, Stack Overflow, and 9 other platforms. Learn with spaced repetition, live code execution, and job gap analysis. The learning layer for the AI era.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**[📖 Full Deployment Guide →](./DEPLOY.md)**

---

## 🏗️ Architecture

```
vibe-code-project/
├── extension/             # The "Grabber" (Chrome Extension)
│   ├── manifest.json      # Extension config (Manifest V3)
│   ├── content.js         # Scrapes AI chat interfaces
│   ├── popup.html         # User interface
│   └── popup.js           # Communication logic
├── backend/               # The "Engine" (FastAPI + Gemini)
│   ├── main.py            # FastAPI entry point
│   ├── schemas.py         # Pydantic models (mirrors React TypeScript)
│   ├── lesson_generator.py # Gemini integration
│   ├── requirements.txt    # Python dependencies
│   └── .env.example       # Environment variables template
├── frontend/              # The "Dashboard" (React + MUI)
│   └── LessonRenderer.tsx # Interactive lesson component
├── lesson.json            # Example lesson structure
└── README.md
```

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Copy env template and add your Gemini API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Install dependencies
pip install -r requirements.txt

# Start the backend
python main.py
```

The backend will start on `http://localhost:8000`. Check `http://localhost:8000/docs` for the interactive API docs.

### 2. Extension Setup

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **Load Unpacked**
4. Select the `extension` folder from this project

### 3. Frontend Setup (Optional for local testing)

```bash
cd frontend
npm install
npm run dev
```

## 🔄 The Data Flow

### **Phase 0: Ingestion**
1. User clicks "Grab Data" in Chrome extension
2. `content.js` scrapes code blocks from AI chat page
3. `popup.js` sends POST to `http://localhost:8000/ingest`
4. Backend acknowledges receipt

### **Phase 1: Generation** ✨ NEW
1. User calls `POST /generate-lesson` with code + context
2. FastAPI sends structured prompt to Gemini 2.0 Flash
3. Gemini returns lesson JSON matching our Lesson schema
4. Frontend receives lesson data and renders interactive lesson

## 📡 API Endpoints

### `POST /ingest`
Ingest code from AI chat.

**Request:**
```json
{
  "code": "def hello():\n    print('Hello')",
  "context": "Write a simple greeting function",
  "url": "https://claude.ai/chat/abc123",
  "source_model": "Claude 3 Opus"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Project data cached. Ready for deconstruction.",
  "project_id": "vibe_a1b2c3d4",
  "next_action": "POST /generate-lesson to create interactive lesson"
}
```

### `POST /generate-lesson`
Generate an interactive lesson from code.

**Request:**
```json
{
  "code": "def hello():\n    print('Hello')",
  "context": "Write a simple greeting function",
  "url": "https://claude.ai/chat/abc123",
  "source_model": "Claude 3 Opus",
  "difficulty": "beginner"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Lesson generated and ready for rendering",
  "data": {
    "lesson": {
      "title": "...",
      "description": "...",
      "steps": [...],
      // Full Lesson object
    }
  }
}
```

### `GET /health`
Health check.

**Response:**
```json
{
  "status": "online",
  "message": "VibeCode Engine running",
  "lesson_generator": "ready"
}
```

## 🎯 Testing the Pipeline

1. **Backend running:**
   ```bash
   python backend/main.py
   ```

2. **Generate a test lesson:**
   ```bash
   curl -X POST http://localhost:8000/generate-lesson \
     -H "Content-Type: application/json" \
     -d '{
       "code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
       "context": "Write a recursive Fibonacci function",
       "url": "https://claude.ai/test",
       "source_model": "Claude",
       "difficulty": "beginner"
     }'
   ```

3. **View the lesson:** Copy the response JSON into the React frontend

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikeys

## 📊 Schema Architecture

The **Pydantic schemas** in `schemas.py` mirror the React TypeScript interfaces exactly. This ensures:
- ✅ Type safety across frontend and backend
- ✅ Gemini's structured outputs match our schema
- ✅ Frontend components render without errors
- ✅ Zero runtime type mismatches

## 🛠️ Architecture Highlights

**Phase 0 (Ingestion):**
- Chrome extension scrapes AI chat → sends to FastAPI

**Phase 1 (Generation):**
- FastAPI receives code + context → calls Gemini with structured schema
- Gemini returns validated Lesson JSON → frontend renders

**Type Safety Chain:**
```
TypeScript Interface → Pydantic Model → Gemini Schema → Response Validation → React Rendering
```

## 🚀 What's Next?

- **Phase 2:** Stream lessons to frontend
- **Phase 3:** Add user progress tracking
- **Phase 4:** Build lesson marketplace
- **Phase 5:** Multi-language support

## 📝 License

MIT
