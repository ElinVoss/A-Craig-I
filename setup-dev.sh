#!/usr/bin/env bash
# VibeCode Local Development Setup Script
# Run: bash setup-dev.sh

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "🚀 VibeCode Phase 3: Local Development Setup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check dependencies
echo "📋 Checking dependencies..."

command -v docker &> /dev/null || { echo "❌ Docker not found. Install from https://www.docker.com"; exit 1; }
command -v python3 &> /dev/null || { echo "❌ Python 3 not found"; exit 1; }
command -v npm &> /dev/null || { echo "❌ Node.js not found"; exit 1; }

echo "✅ All dependencies found"
echo ""

# Create .env file
echo "🔐 Setting up environment variables..."
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  cat >> backend/.env << EOF

# Database Configuration
DATABASE_URL=postgresql://vibeCodeUser:vibeCodePassword123@localhost:5432/vibeCode

# JWT Configuration
JWT_SECRET_KEY=$(openssl rand -hex 32)
EOF
  echo "✅ Created backend/.env"
else
  echo "ℹ️  backend/.env already exists"
fi

echo ""
echo "🐳 Starting PostgreSQL with Docker..."

# Check if container already running
if docker ps | grep -q "vibeCode-db"; then
  echo "ℹ️  PostgreSQL already running"
else
  docker-compose up -d postgres
  echo "✅ PostgreSQL started (waiting for health check...)"
  sleep 5
fi

echo ""
echo "🗄️  Running database migrations..."
cd backend
python -m pip install -q alembic sqlalchemy psycopg2-binary 2>/dev/null || true
python -m alembic upgrade head
echo "✅ Migrations complete"

echo ""
echo "🌱 Seeding development data..."
python -c "
from seed_db import seed_database
try:
    seed_database()
    print('✅ Database seeded')
except Exception as e:
    print(f'⚠️  Seed warning: {e}')
"

echo ""
echo "📦 Installing backend dependencies..."
pip install -q -r requirements.txt
echo "✅ Backend ready"

cd ..
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --quiet
echo "✅ Frontend ready"
cd ..

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✨ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "Terminal 1 - Start Backend:"
echo "  cd backend && python main.py"
echo ""
echo "Terminal 2 - Start Frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "Then visit: http://localhost:3000"
echo ""
echo "📊 Quick Commands:"
echo "  • View API Docs:   http://localhost:8000/docs"
echo "  • Health Check:    curl http://localhost:8000/health"
echo "  • Database:        psql -U vibeCodeUser -d vibeCode"
echo "  • Run Tests:       cd backend && pytest test_auth_integration.py -v"
echo ""
echo "════════════════════════════════════════════════════════════════"
