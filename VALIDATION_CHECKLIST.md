# ✅ VibeCode Setup Validation Checklist

Use this to verify your installation is complete and working.

## Pre-Requisites

- [ ] Python 3.9 or higher installed
- [ ] Node.js 16 or higher installed
- [ ] Chrome browser (latest version)
- [ ] Gemini API key (get from https://makersuite.google.com/app/apikeys)
- [ ] Git (optional, for version control)

---

## Backend Setup

### Environment
- [ ] Navigated to `/backend` directory
- [ ] Created `.env` file from `.env.example`
- [ ] Added `GEMINI_API_KEY=<your_key>` to `.env`
- [ ] Verified `.env` is NOT committed (check `.gitignore`)

### Dependencies
- [ ] Ran `pip install -r requirements.txt`
- [ ] All dependencies installed without errors
- [ ] Verified installations:
  ```bash
  python -c "import fastapi; import pydantic; import google.generativeai"
  ```

### Startup
- [ ] Backend starts: `python main.py`
- [ ] Server logs show:
  ```
  🚀 Starting VibeCode Engine on http://0.0.0.0:8000
  📖 API docs available at http://localhost:8000/docs
  📚 Lesson generation enabled: Yes
  ```
- [ ] Visit `http://localhost:8000/docs` — FastAPI Swagger UI loads
- [ ] Health check works: `curl http://localhost:8000/health`

### File Structure
- [ ] `backend/main.py` exists (~2.8 KB)
- [ ] `backend/schemas.py` exists (~7.3 KB, 16 models)
- [ ] `backend/lesson_generator.py` exists (~5.9 KB)
- [ ] `backend/requirements.txt` exists
- [ ] `backend/.env` exists with your API key
- [ ] `backend/__init__.py` exists
- [ ] `backend/.env` is NOT in git (check `.gitignore`)

---

## Frontend Setup

### React Component
- [ ] `frontend/LessonRenderer.tsx` exists (~23.5 KB)
- [ ] TypeScript interfaces defined (Lesson, LessonStep, Quiz, etc.)
- [ ] All sub-components present:
  - [ ] `<QuizBlock />`
  - [ ] `<FillInTheBlanksExercise />`
  - [ ] `<DataJourneyTimeline />`
  - [ ] Main `<LessonRenderer />`

### Type Safety
- [ ] Can view full TypeScript types:
  ```bash
  grep -n "interface Lesson" frontend/LessonRenderer.tsx
  ```

---

## Chrome Extension Setup

### Files
- [ ] `extension/manifest.json` exists
- [ ] `extension/content.js` exists
- [ ] `extension/popup.html` exists
- [ ] `extension/popup.js` exists
- [ ] Manifest V3 (not V2)

### Loading Extension
- [ ] Opened Chrome → `chrome://extensions`
- [ ] Enabled "Developer Mode"
- [ ] Clicked "Load Unpacked"
- [ ] Selected `extension/` folder
- [ ] Extension appears: "VibeCode Teacher"
- [ ] Extension status shows "Enabled"
- [ ] No errors in extension (check chrome://extensions for error link)

### Extension Functionality
- [ ] Visited Claude.ai or ChatGPT.com
- [ ] Asked AI to write code
- [ ] Clicked VibeCode extension icon
- [ ] Popup appeared with 2 buttons:
  - [ ] "🎯 Grab Data"
  - [ ] "📤 Send to Backend"
- [ ] Clicked "Grab Data"
- [ ] Status shows code was grabbed (green status)
- [ ] Clicked "Send to Backend"
- [ ] Check backend terminal for:
  ```
  📥 Received code from: https://...
  📝 Context preview: ...
  ```

---

## API Testing

### Health Check
- [ ] Run: `curl http://localhost:8000/health`
- [ ] Returns: `{"status": "online", ...}`

### Ingestion Endpoint
- [ ] Run: 
  ```bash
  curl -X POST http://localhost:8000/ingest \
    -H "Content-Type: application/json" \
    -d '{
      "code": "print(\"hello\")",
      "context": "print hello world",
      "url": "test",
      "source_model": "Test"
    }'
  ```
- [ ] Returns: `{"status": "success", "project_id": "vibe_..."}`

### Lesson Generation Endpoint
- [ ] Run: `python test_api_endpoints.py`
- [ ] All tests pass
- [ ] Lesson JSON generated successfully
- [ ] File `example_generated_lesson.json` created

---

## Validation Testing

### Test Suite 1: Lesson Generation
- [ ] Ran: `python test_lesson_generation.py`
- [ ] Output shows:
  ```
  ✅ GEMINI_API_KEY found
  ✅ Lesson generator initialized
  ✅ Lesson generated successfully!
  ✅ Lesson saved to generated_lesson.json
  🎉 All tests passed!
  ```
- [ ] File `generated_lesson.json` created

### Test Suite 2: API Endpoints
- [ ] Ran: `python test_api_endpoints.py`
- [ ] All 3 endpoints tested:
  - [ ] `/health` - passes
  - [ ] `/ingest` - passes
  - [ ] `/generate-lesson` - passes
- [ ] Lesson generated and saved to `example_generated_lesson.json`

---

## Schema Validation

### Pydantic Models
- [ ] Count: 16 models defined
- [ ] All models have descriptions
- [ ] All models use `Field()` for validation

### Model Checklist
- [ ] QuizOption
- [ ] Quiz
- [ ] CodeHighlight
- [ ] ModelField
- [ ] ModelBreakdown
- [ ] BlankExercise
- [ ] FillInTheBlanksExercise
- [ ] DataJourneyStage
- [ ] TimelineSegment
- [ ] Timeline
- [ ] StepContent
- [ ] LessonStep
- [ ] Metadata
- [ ] LessonSummary
- [ ] Lesson
- [ ] LessonWrapper

---

## Documentation

### Files
- [ ] `README.md` - API reference ✓
- [ ] `ARCHITECTURE.md` - System design (13 KB) ✓
- [ ] `QUICKSTART.md` - 5-minute setup ✓
- [ ] `COMPLETION_SUMMARY.md` - What was built ✓
- [ ] `VALIDATION_CHECKLIST.md` - This file ✓
- [ ] `lesson.json` - Example lesson (15 KB) ✓

### Content
- [ ] README explains all 3 endpoints
- [ ] ARCHITECTURE covers full data flow
- [ ] QUICKSTART has step-by-step setup
- [ ] Example code provided for each endpoint

---

## Integration Testing

### End-to-End Flow
1. [ ] Backend running on `localhost:8000`
2. [ ] Extension loaded in Chrome
3. [ ] Visited AI chat site (Claude, ChatGPT, Gemini)
4. [ ] Asked AI to write code
5. [ ] Clicked VibeCode extension
6. [ ] Grabbed data from page
7. [ ] Sent to backend
8. [ ] Backend logged ingestion
9. [ ] Called `/generate-lesson` endpoint
10. [ ] Received lesson JSON
11. [ ] Copied JSON to React component
12. [ ] Lesson rendered in browser
13. [ ] Completed quiz step
14. [ ] Completed exercise step
15. [ ] Viewed visualization step
16. [ ] All navigation worked

---

## Performance Metrics

Record your actual performance:

```
Extension DOM scraping:      ____ ms (should be ~50ms)
HTTP POST to backend:        ____ ms (should be ~50ms)
Gemini lesson generation:    ____ ms (should be ~1-2s)
Pydantic validation:         ____ ms (should be ~10ms)
React rendering:             ____ ms (should be ~100ms)
                            ─────────
Total end-to-end:            ____ ms (target: <2.5s)
```

---

## Common Issues & Fixes

### Issue: "GEMINI_API_KEY not set"
- [ ] `.env` file exists in `backend/`
- [ ] File contains `GEMINI_API_KEY=<key>`
- [ ] No spaces around `=` sign
- [ ] Restarted backend after creating `.env`

### Issue: "ModuleNotFoundError: google.generativeai"
- [ ] Ran `pip install -r requirements.txt`
- [ ] Check Python version: `python --version` (need 3.9+)
- [ ] Run: `pip install --upgrade google-generativeai`

### Issue: "Connection refused" to backend
- [ ] Backend is running: `python backend/main.py`
- [ ] Port 8000 is free (check: `lsof -i :8000`)
- [ ] No firewall blocking localhost:8000
- [ ] Correct URL in all requests

### Issue: Extension not capturing code
- [ ] Hard refresh page: Ctrl+Shift+R
- [ ] Reload extension: Icon in chrome://extensions
- [ ] Check manifest.json matches AI chat URLs
- [ ] Look for console errors: F12 → Console tab

### Issue: Lesson generation times out
- [ ] Check Gemini API quota: https://console.cloud.google.com/
- [ ] May be rate-limited (free tier has limits)
- [ ] Try again in a few minutes
- [ ] Check https://status.cloud.google.com/ for outages

---

## Success Indicators

You're ready when:

✅ Backend starts without errors  
✅ All 3 endpoints respond correctly  
✅ Extension loads in Chrome  
✅ `test_lesson_generation.py` passes  
✅ `test_api_endpoints.py` passes  
✅ End-to-end flow works (code → lesson)  
✅ Lesson renders in React  
✅ Quiz validation works  
✅ All documentation is clear  
✅ You understand the architecture  

---

## Next Steps

1. [ ] Deploy backend to cloud (AWS Lambda, Google Cloud Run, etc.)
2. [ ] Publish extension to Chrome Web Store
3. [ ] Build frontend dashboard app
4. [ ] Add database for lesson storage
5. [ ] Implement user authentication
6. [ ] Add progress tracking
7. [ ] Build lesson marketplace
8. [ ] Add multi-language support

---

## Support Resources

If you get stuck:

1. Check the relevant docs:
   - Setup issues → `QUICKSTART.md`
   - Architecture questions → `ARCHITECTURE.md`
   - API issues → `README.md`
   - What was built → `COMPLETION_SUMMARY.md`

2. Review test output:
   - `python test_lesson_generation.py`
   - `python test_api_endpoints.py`

3. Check backend logs:
   - Look for emoji indicators (📥, 🔄, ✨, ❌)
   - Verify Gemini API key is working

4. Check extension logs:
   - Chrome → Extensions → VibeCode Teacher → Errors
   - Browser console: F12 → Console tab

---

**Date Completed:** _______________

**Tester Name:** ___________________

**Notes:** _________________________

---

**Once all items are checked, you're ready to deploy VibeCode! 🚀**
