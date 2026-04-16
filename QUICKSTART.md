# 🚀 VibeCode Quick Start Guide

Get your lesson generation engine running in 5 minutes.

## Prerequisites Check

```bash
# Python 3.9+
python --version

# Node.js 16+
node --version

# Chrome browser (latest version)
google-chrome --version  # or chrome on macOS
```

## Step 1: Get Your Gemini API Key (2 min)

1. Visit: https://makersuite.google.com/app/apikeys
2. Click "Create API Key"
3. Copy the key
4. Save it somewhere safe

## Step 2: Set Up Backend (2 min)

```bash
# Navigate to backend
cd backend

# Create .env file with your API key
cat > .env << EOF
GEMINI_API_KEY=your_api_key_here
EOF

# Install dependencies
pip install -r requirements.txt

# Start server
python main.py
```

You should see:
```
🚀 Starting VibeCode Engine on http://0.0.0.0:8000
📖 API docs available at http://localhost:8000/docs
📚 Lesson generation enabled: Yes
```

## Step 3: Test the Pipeline (1 min)

In a **new terminal** (keep backend running):

```bash
cd vibe-code-project

# Run the test script
python test_lesson_generation.py
```

If successful, you'll see:
```
✅ GEMINI_API_KEY found
✅ Lesson generator initialized
✅ Lesson generated successfully!
✅ Lesson saved to generated_lesson.json
🎉 All tests passed! Ready to use VibeCode.
```

## Step 4: Load Chrome Extension

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable "Developer Mode" (toggle in top-right)
4. Click "Load Unpacked"
5. Select the `extension` folder
6. You should see "VibeCode Teacher" extension

## Step 5: Try It Out

1. Go to **Claude.ai** (or ChatGPT.com, Gemini)
2. Ask: "Write a simple Python function that returns the sum of two numbers"
3. Click the **VibeCode Teacher** extension icon
4. Click **"🎯 Grab Data"**
5. Click **"📤 Send to Backend"**
6. Check your backend terminal—you should see the ingestion log

## Generate Your First Lesson

```bash
curl -X POST http://localhost:8000/generate-lesson \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def add(a, b):\n    return a + b",
    "context": "Write a function that returns the sum of two numbers",
    "url": "https://claude.ai/test",
    "source_model": "Claude",
    "difficulty": "beginner"
  }'
```

Copy the response JSON (everything in the `"data"` field) and paste it into React to see the lesson render!

## 🎯 What You've Just Done

✅ Set up Gemini API integration  
✅ Validated Pydantic schemas  
✅ Generated a lesson from code  
✅ Confirmed the full pipeline works  

## 🚨 Troubleshooting

### "GEMINI_API_KEY not set"
```bash
# Check .env file exists
cat backend/.env

# If not, create it:
echo "GEMINI_API_KEY=your_key_here" > backend/.env
```

### "ModuleNotFoundError: No module named 'google.generativeai'"
```bash
# Reinstall dependencies
pip install --upgrade -r backend/requirements.txt
```

### "Connection refused" (can't reach backend)
```bash
# Make sure backend is running in another terminal
python backend/main.py

# Check if port 8000 is in use
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows
```

### "Extension not loading"
- Hard refresh Chrome: Ctrl+Shift+R
- Check chrome://extensions for errors
- Reload extension (refresh icon)

### "Gemini API error"
- Check your API key is correct
- Verify it's not rate-limited (free tier has limits)
- Check https://status.cloud.google.com/ for service status

## 📚 Next Steps

1. **Explore the code:**
   - `backend/main.py` — API endpoints
   - `backend/schemas.py` — Data models
   - `frontend/LessonRenderer.tsx` — React components

2. **Read the docs:**
   - `ARCHITECTURE.md` — Full system design
   - `README.md` — API reference

3. **Customize lessons:**
   - Modify prompts in `lesson_generator.py`
   - Adjust difficulty levels
   - Add new step types

## 🎓 Understanding the Stack

```
User writes code in Claude/ChatGPT
         ↓
Chrome Extension captures it (content.js)
         ↓
Sends to FastAPI backend (/ingest endpoint)
         ↓
Backend calls Gemini with structured schema
         ↓
Gemini returns lesson JSON
         ↓
Frontend renders with React components
         ↓
User learns interactively (quiz, code exercise, visualization)
```

## 💡 Pro Tips

- **Test with different code:** Try it with JavaScript, JavaScript, etc.
- **Adjust prompts:** Edit `lesson_generator.py` to change lesson style
- **Monitor logs:** Backend logs show exactly what Gemini is doing
- **Use DevTools:** Chrome DevTools → Network tab shows all API calls

## ✅ You're Ready!

You now have a fully functional AI teaching engine. The entire pipeline—from code capture to interactive lesson generation—is working.

**Next phase:** Stream lessons to frontend, add progress tracking, build lesson marketplace.

---

Need help? Check `ARCHITECTURE.md` for deep dives into each component.

Happy learning! 🚀
