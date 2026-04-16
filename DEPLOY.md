# 🚀 VibeCode Deployment Guide

Deploy the full stack in ~15 minutes using free tiers:
- **Backend** → [Render](https://render.com) (free Web Service + free Postgres)
- **Frontend** → [Vercel](https://vercel.com) (free Hobby plan)
- **Database** → Render's managed Postgres *or* [Neon](https://neon.tech) (serverless, better free tier)

---

## 1. Database — Neon (Recommended)

Neon gives you a serverless Postgres with a permanent free tier (no 90-day expiry like Render's DB).

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project → `vibecode`
3. Copy the **Connection String** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/vibecode?sslmode=require
   ```
4. Save it — you'll paste it into Render as `DATABASE_URL`

---

## 2. Backend — Render

### Option A: Blueprint (automatic, recommended)

1. Fork/push this repo to GitHub
2. Go to [render.com/deploy](https://render.com/deploy) → **New Blueprint**
3. Connect your repo — Render detects `render.yaml` automatically
4. Fill in the **manual env vars** (those marked `sync: false`):

   | Variable | Where to get it |
   |---|---|
   | `GEMINI_API_KEY` | [makersuite.google.com/app/apikeys](https://makersuite.google.com/app/apikeys) |
   | `DATABASE_URL` | Neon connection string from step 1 |
   | `STRIPE_SECRET_KEY` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) → Test mode |
   | `STRIPE_WEBHOOK_SECRET` | After step 3 below |
   | `STRIPE_PRO_PRICE_ID` | After creating products in Stripe |
   | `STRIPE_TEAM_PRICE_ID` | After creating products in Stripe |
   | `FRONTEND_URL` | Your Vercel URL (fill in after step 3) |

5. Click **Apply** — Render builds the Docker image, runs `start.sh` (migrations → uvicorn)
6. Your backend URL: `https://vibecode-backend.onrender.com`

### Option B: Manual Web Service

1. New → **Web Service** → connect repo
2. **Root Directory**: `backend`  
3. **Runtime**: Docker  
4. **Start Command**: `bash /app/start.sh`
5. Set all env vars from the table above

---

## 3. Stripe Setup

### Create Products
1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → Add product
2. Create **VibeCode Pro** — $12/month recurring → copy Price ID → set `STRIPE_PRO_PRICE_ID`
3. Create **VibeCode Team** — $49/month recurring → copy Price ID → set `STRIPE_TEAM_PRICE_ID`

### Webhook Endpoint
1. Stripe Dashboard → **Webhooks** → Add endpoint
2. URL: `https://vibecode-backend.onrender.com/api/billing/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
4. Copy **Signing Secret** → set `STRIPE_WEBHOOK_SECRET` in Render

### Test the Flow
```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to https://vibecode-backend.onrender.com/api/billing/webhook
stripe trigger checkout.session.completed
```

---

## 4. Frontend — Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo
2. Vercel detects `vercel.json` at the root — settings are pre-configured
3. Set **Environment Variables** in Vercel dashboard:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://vibecode-backend.onrender.com` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` from Stripe dashboard |

4. Click **Deploy** — Vercel runs `npm install && npm run build` in `frontend/`
5. Your frontend URL: `https://vibecode.vercel.app`

6. Go back to Render → set `FRONTEND_URL=https://vibecode.vercel.app`

---

## 5. Chrome Extension — Point to Production

1. Open `extension/popup.js`
2. Change line 1:
   ```js
   const BACKEND_URL = "https://vibecode-backend.onrender.com";
   ```
3. Reload the extension in `chrome://extensions`

For production distribution, publish to Chrome Web Store:
- [developer.chrome.com/docs/webstore/publish](https://developer.chrome.com/docs/webstore/publish)
- One-time $5 developer fee

---

## 6. Verify Everything Works

```bash
# 1. Health check
curl https://vibecode-backend.onrender.com/health

# 2. Auth flow
curl -X POST https://vibecode-backend.onrender.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","username":"testuser","password":"SecurePass123"}'

# 3. Check billing status (use token from signup)
curl https://vibecode-backend.onrender.com/api/billing/status \
  -H "Authorization: Bearer <access_token>"
```

---

## Local Development (full stack)

```bash
# 1. Backend
cd backend
cp .env.example .env   # fill in GEMINI_API_KEY
pip install -r requirements.txt
alembic upgrade head
python main.py

# 2. Frontend
cd frontend
cp .env.example .env.local   # set VITE_API_URL=http://localhost:8000
npm install
npm run dev   # opens http://localhost:3000

# 3. Docker (everything at once)
cp backend/.env.example backend/.env   # fill in GEMINI_API_KEY
docker-compose up --build
```

---

## Architecture Summary

```
Browser (Chrome Extension)
    │  GRAB_DATA → captureContext()
    ▼
[Vercel] React Frontend (vibecode.vercel.app)
    │  fetch /api/* → VITE_API_URL
    ▼
[Render] FastAPI Backend (vibecode-backend.onrender.com)
    │  start.sh: alembic upgrade head → uvicorn
    ├── Gemini API (lesson generation, validation, gap analysis)
    ├── Stripe API (subscriptions, webhooks)
    └── [Neon] PostgreSQL
            └── users, lessons, review_cards, review_logs,
                engagement_events, lesson_upvotes, concepts
```
