@echo off
REM VibeCode Local Development Setup Script (Windows)
REM Run: setup-dev.bat

setlocal enabledelayedexpansion

echo.
echo ================================================================
echo 🚀 VibeCode Phase 3: Local Development Setup (Windows)
echo ================================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Docker not found. Install from https://www.docker.com
    exit /b 1
)
echo ✅ Docker found

REM Check if Python is installed
python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Python not found
    exit /b 1
)
echo ✅ Python found

REM Check if Node is installed
npm --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js not found
    exit /b 1
)
echo ✅ Node.js found

echo.
echo 🔐 Setting up environment variables...

if not exist "backend\.env" (
    copy backend\.env.example backend\.env
    echo DATABASE_URL=postgresql://vibeCodeUser:vibeCodePassword123@localhost:5432/vibeCode >> backend\.env
    echo JWT_SECRET_KEY=dev-key-change-in-production >> backend\.env
    echo ✅ Created backend\.env
) else (
    echo ℹ️  backend\.env already exists
)

echo.
echo 🐳 Starting PostgreSQL with Docker...

docker ps | findstr "vibeCode-db" >nul 2>&1
if !errorlevel! equ 0 (
    echo ℹ️  PostgreSQL already running
) else (
    docker run --name vibeCode-db ^
      -e POSTGRES_USER=vibeCodeUser ^
      -e POSTGRES_PASSWORD=vibeCodePassword123 ^
      -e POSTGRES_DB=vibeCode ^
      -p 5432:5432 ^
      -d postgres:16-alpine
    echo ✅ PostgreSQL started
    timeout /t 5 /nobreak
)

echo.
echo 🗄️  Running database migrations...
cd backend
pip install -q alembic sqlalchemy psycopg2-binary >nul 2>&1
python -m alembic upgrade head
echo ✅ Migrations complete
cd ..

echo.
echo 🌱 Seeding development data...
cd backend
python seed_db.py >nul 2>&1
echo ✅ Database seeded
cd ..

echo.
echo 📦 Installing backend dependencies...
cd backend
pip install -q -r requirements.txt
echo ✅ Backend ready
cd ..

echo.
echo 📦 Installing frontend dependencies...
cd frontend
call npm install --quiet
echo ✅ Frontend ready
cd ..

echo.
echo ================================================================
echo ✨ SETUP COMPLETE!
echo ================================================================
echo.
echo 🚀 Next Steps:
echo.
echo Terminal 1 - Start Backend:
echo   cd backend
echo   python main.py
echo.
echo Terminal 2 - Start Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo Then visit: http://localhost:3000
echo.
echo 📊 Quick Commands:
echo   - View API Docs:   http://localhost:8000/docs
echo   - Health Check:    curl http://localhost:8000/health
echo   - Run Tests:       cd backend ^&^& pytest test_auth_integration.py -v
echo.
echo ================================================================
echo.
pause
