# 🚀 VibeCode Phase 3 - Complete Setup & Deployment Guide

## ⚡ Quick Start (5 minutes)

### Prerequisites
- Python 3.9+ 
- Node.js 16+
- PostgreSQL 14+ (or Docker)
- Gemini API key

### Step 1: Clone & Setup Backend
```bash
cd vibe-code-project/backend

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# GEMINI_API_KEY=your_key_here
# DATABASE_URL=postgresql://user:password@localhost:5432/vibeCode
# JWT_SECRET_KEY=your-super-secret-key-change-in-production
```

### Step 2: Setup PostgreSQL
```bash
# Option A: Docker (easiest)
docker run --name vibeCode-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=vibeCode \
  -p 5432:5432 -d postgres:16

# Option B: Local PostgreSQL
# Windows: https://www.postgresql.org/download/windows/
# macOS: brew install postgresql@16
# Linux: sudo apt install postgresql-16
```

### Step 3: Initialize Database
```bash
# Run migrations
alembic upgrade head

# Seed with sample data
python seed_db.py
```

### Step 4: Start Backend Server
```bash
python main.py
# Server running at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Step 5: Setup Frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Update .env if needed
cat > .env.local << EOF
REACT_APP_API_URL=http://localhost:8000
EOF

# Start development server
npm run dev
# Frontend running at http://localhost:3000
```

---

## 📋 Verification Checklist

After setup, verify everything works:

### Backend Health Check
```bash
# Check API is running
curl http://localhost:8000/health

# Check database connection
curl http://localhost:8000/health | grep database
```

### Test Signup/Login
```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "username":"testuser",
    "password":"TestPass123"
  }'

# Should return access_token and refresh_token
```

### Test Protected Route
```bash
# Get current user (replace TOKEN with access_token from signup)
curl -X GET http://localhost:8000/api/me \
  -H "Authorization: Bearer TOKEN"
```

### Run Tests
```bash
cd backend
pytest test_auth_integration.py -v
# Should see 15+ tests pass
```

---

## 📊 Database Setup Details

### Connection Pool Configuration
```python
# From database.py
pool_size=10           # Keep 10 connections open
max_overflow=20        # Allow up to 20 more if needed
pool_recycle=3600      # Refresh connections after 1 hour
pool_pre_ping=True     # Check connection is alive before using
```

### Database Schema
```sql
-- 5 tables automatically created by alembic
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- + lessons, user_progress, lesson_ratings, refresh_tokens
-- (see migrations/versions/001_initial_schema.py for full schema)
```

---

## 🔐 Environment Variables Reference

```bash
# Required
GEMINI_API_KEY=your_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/vibeCode

# Authentication (can use defaults)
JWT_SECRET_KEY=change-this-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Optional
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
ENVIRONMENT=development
```

---

## 🧪 Running Tests

### Unit Tests
```bash
cd backend
pytest test_auth_integration.py -v
```

### Specific Test Class
```bash
pytest test_auth_integration.py::TestAuthSignup -v
```

### Coverage Report
```bash
pytest test_auth_integration.py --cov=. --cov-report=html
# Opens htmlcov/index.html in browser
```

---

## 📝 Common Issues & Solutions

### Issue: "Connection refused" on localhost:5432
**Solution**: Ensure PostgreSQL is running
```bash
# Check if running
docker ps | grep vibeCode-db

# If not, start it
docker start vibeCode-db
```

### Issue: "Gemini API Key Invalid"
**Solution**: Verify your API key
1. Go to https://makersuite.google.com/app/apikeys
2. Copy your API key
3. Update .env file: `GEMINI_API_KEY=your_actual_key`
4. Restart backend: `python main.py`

### Issue: "Module not found: jose" or "bcrypt"
**Solution**: Install dependencies
```bash
pip install -r requirements.txt
```

### Issue: Tests fail with "No module named 'models'"
**Solution**: Run from backend directory
```bash
cd backend
pytest test_auth_integration.py -v
```

### Issue: "Access token invalid" in frontend
**Solution**: Tokens may have expired
- Clear browser localStorage: DevTools → Application → Storage
- Sign in again
- Refresh should work automatically now

---

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [ ] Update `JWT_SECRET_KEY` to a secure random string
- [ ] Set `ENVIRONMENT=production`
- [ ] Enable HTTPS
- [ ] Restrict CORS to frontend domain only
- [ ] Set up environment variables securely
- [ ] Run full test suite
- [ ] Test database backups

### Environment Variables (Production)
```bash
# .env.production
ENVIRONMENT=production
GEMINI_API_KEY=<your_production_key>
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/vibeCode
JWT_SECRET_KEY=<generate_with: python -c "import secrets; print(secrets.token_urlsafe(32))">
FRONTEND_URL=https://yourdomain.com
```

### Backend Deployment (AWS Lambda + RDS)
```bash
# 1. Create requirements-prod.txt (without dev dependencies)
pip freeze | grep -v pytest > requirements-prod.txt

# 2. Use serverless framework or AWS SAM
# 3. Deploy with managed PostgreSQL (AWS RDS)

# 4. Update Lambda environment variables
```

### Frontend Deployment (Vercel, Netlify)
```bash
# 1. Update REACT_APP_API_URL to production backend URL
# 2. Build production bundle
npm run build

# 3. Deploy to Vercel
vercel deploy --prod

# Or to Netlify
netlify deploy --prod --dir=build
```

---

## 📈 Monitoring & Logging

### Backend Logs
```bash
# Start with verbose logging
ENVIRONMENT=development python main.py

# Logs include:
# - Authentication events
# - Database queries
# - API errors
# - Lesson generation timing
```

### Health Check Endpoint
```bash
# Monitor in production
curl https://yourdomain.com/health
# Response:
# {
#   "status": "online",
#   "database": "connected",
#   "lesson_generator": "ready"
# }
```

### Database Monitoring
```bash
# Check connection pool status
SELECT * FROM pg_stat_activity;

# Monitor query performance
SELECT query, calls, total_time, mean_time FROM pg_stat_statements;
```

---

## 🔄 Database Migrations

### Create a new migration
```bash
# After modifying models.py
alembic revision --autogenerate -m "description of changes"

# Review the generated file in migrations/versions/
# Then apply it
alembic upgrade head
```

### Rollback a migration
```bash
# See migration history
alembic history

# Downgrade to previous version
alembic downgrade -1

# Or downgrade to specific version
alembic downgrade 001_initial_schema
```

---

## 🎓 API Documentation

### Auto-Generated Docs
```
# Swagger UI
http://localhost:8000/docs

# ReDoc
http://localhost:8000/redoc
```

### Manual API Testing
```bash
# Using curl
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Using Postman
# 1. Import: http://localhost:8000/openapi.json
# 2. Create requests with Authorization header
# 3. Use access_token from login response
```

---

## 📚 Project Structure

```
vibe-code-project/
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── models.py                  # SQLAlchemy ORM
│   ├── database.py                # Connection management
│   ├── auth.py                    # JWT + bcrypt
│   ├── schemas.py                 # Pydantic models
│   ├── lesson_generator.py        # Gemini integration
│   ├── seed_db.py                 # Development data
│   ├── test_auth_integration.py   # Tests
│   ├── migrations/                # Alembic migrations
│   ├── alembic.ini                # Migration config
│   ├── requirements.txt           # Dependencies
│   └── .env.example               # Template
├── frontend/
│   ├── App_v2.tsx                 # Main app
│   ├── AuthContext.tsx            # Auth state
│   ├── AuthModal.tsx              # Auth forms
│   ├── LessonRenderer_v2.tsx       # Lesson viewer
│   ├── LessonLibrary.tsx          # Saved lessons
│   ├── package.json               # Dependencies
│   └── .env.local                 # Frontend config
├── extension/                     # Chrome extension (from Phase 0)
├── PHASE3_COMPLETE.md             # This file
└── QUICKSTART.md                  # Quick reference
```

---

## 🎯 Next Steps

### Short Term (Week 1)
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Setup monitoring & alerts
- [ ] Test end-to-end workflow

### Medium Term (Month 1)
- [ ] Add email verification
- [ ] Implement password reset
- [ ] Setup analytics
- [ ] Create admin dashboard

### Long Term (Quarter 1)
- [ ] Public lesson library
- [ ] Lesson sharing & collaboration
- [ ] Advanced rating system
- [ ] Monetization (premium lessons)

---

## 🆘 Support & Troubleshooting

### Getting Help
1. Check PHASE3_COMPLETE.md for feature overview
2. Review test_auth_integration.py for usage examples
3. Check FastAPI docs at http://localhost:8000/docs
4. Search GitHub issues for similar problems

### Debugging Tips
```bash
# Enable SQL logging
# In database.py, change: echo=False to echo=True

# View database state
psql -U user -d vibeCode
SELECT * FROM users;
SELECT * FROM lessons;

# Check token contents
# Decode JWT at https://jwt.io with your token

# Monitor background jobs
# Check logs in main.py with DEBUG level
```

---

**Version**: 1.0.0 (Phase 3 Complete)  
**Last Updated**: 2025-01-16  
**Status**: Production Ready ✅
