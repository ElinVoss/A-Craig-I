# VibeCode: Product Roadmap & Strategy

**Decision framework:** Each feature scored on (Learning Science Impact × Competitive Moat) ÷ Build Complexity

---

## THE THREE LOOPS

Every successful learning product runs on three interlocking loops. VibeCode's current state:

```
CAPTURE LOOP      ✅ Working
  Browser → Extension → FastAPI → Lesson generated

LEARNING LOOP     ⚠️ Partial
  Quiz + fill-in-blank exist. No code execution. No depth control.

RETENTION LOOP    ❌ Missing
  Nothing resurfaces what you learned. Leaky bucket.
```

Without the retention loop, everything in Phases 0-3 is wasted. Users learn once and forget. 
**This is the single biggest gap vs Codecademy** (who also didn't have it — and it killed their long-term value).

---

## RESEARCH FINDINGS THAT CHANGED THE PLAN

### 1. FSRS beats SM-2 (and both beat doing nothing)
- SM-2 (Anki classic): Simple, proven, widely implemented
- FSRS (2024 standard): ML-based, 15-20% better retention for same review effort
- **Decision:** Start with SM-2 for speed, migrate to FSRS once we have user data
- Both are open source: `open-spaced-repetition/fsrs4anki`

### 2. Code Execution Is Codecademy's #1 Retention Driver
- Users who run code in-lesson stay 3x longer (Codecademy internal data)
- **No backend needed for most cases:**
  - Python → Pyodide (CPython compiled to WASM, runs in browser)
  - JS/TS → Sandboxed iframe
  - Everything else → Judge0 API (self-hostable)
- This is Phase 4 Day 1, not a "nice to have"

### 3. Duolingo's Real Secret
- Not streaks. Not XP. Not leaderboards.
- **55% next-day retention** came from: ML-personalized review timing + behavioral nudges
- Churn dropped from 47% (2020) → 28% (2026) as personalization improved
- VibeCode equivalent: FSRS + mobile review + push notifications = same mechanism

### 4. Brilliant's Lesson
- Smallest user base, deepest engagement
- Model: problem-solving over passive reading
- Retention rates 60-80% when learners apply knowledge vs 10-20% for passive reading
- VibeCode's fill-in-blank + code execution is exactly this model

### 5. Knowledge Graphs Are Now LLM-Native
- GPT-4/Claude can auto-detect concept prerequisites from lesson content
- No need to hand-curate curriculum like Codecademy did
- Prompt: "Extract concepts in this lesson + list 3 prerequisite concepts"
- Store as directed graph: concept → requires → concept
- This is the foundation for adaptive learning paths — fully automatable

### 6. Monetization: Hybrid Wins
- Pure B2C freemium: 2-8% conversion, high churn
- Pure B2B: long sales cycles, low velocity
- **Winning model (2024):** Freemium B2C as distribution + B2B team tier as revenue engine
- Examples: Notion, Linear, Figma — all grew B2C first, monetized B2B
- VibeCode's B2B angle: bootcamps, developer teams, corporate onboarding

---

## THE PHASED ROADMAP

### Phase 4: The Retention Engine
**Why first:** Without retention, Phases 0-3 are wasted. Users learn once and forget 80%.
**Build time estimate:** 3-4 weeks

#### 4A: FSRS Spaced Repetition (unblocked, start now)
```
New DB table: review_cards
  - id, lesson_id, user_id
  - stability, difficulty (FSRS params)
  - due_date, last_reviewed_at
  - review_count, lapse_count

New endpoint: POST /api/review/complete
  Input: { card_id, rating: 1-4 }
  Logic: FSRS formula → update stability + difficulty → calculate next due_date

New endpoint: GET /api/review/due
  Returns: cards due today, ordered by urgency
```

#### 4B: Mobile-First Review UI (depends on 4A)
```
New React component: <DailyReview />
  - Shows due card count on app load ("3 concepts due for review")
  - Card flip: concept name → code snippet → explanation
  - Rating buttons: Again / Hard / Good / Easy
  - Progress bar: X of Y reviewed today
  - PWA manifest: installable on home screen
  - Push notifications: "You have 5 reviews due"
```

#### 4C: In-Lesson Code Execution (unblocked, start now)
```
Python lessons:
  - Load Pyodide (lazy, only when Python lesson opens)
  - Add Run button to every code block in LessonRenderer
  - Output appears below code block, inline

JS/TS lessons:
  - Sandboxed iframe with postMessage API
  - No Pyodide overhead for the common case

Multi-language fallback:
  - Self-hosted Judge0 (Docker container)
  - API: POST /api/execute { language, code }
```

#### 4D: Misconception Micro-Lessons (depends on 4B)
```
Update QuizBlock: on wrong answer, do NOT reveal correct answer immediately
Call: POST /api/lessons/micro-generate
  Input: { wrong_answer, correct_answer, lesson_context }
  Gemini prompt: "The learner answered X instead of Y.
                  Identify the specific misconception.
                  Generate a 60-second micro-lesson fixing only that mental model gap.
                  Return as MicroLesson schema."
Show micro-lesson inline before revealing correct answer
```

---

### Phase 5: The Intelligence Layer
**Why second:** Depth slider alone dramatically increases lesson quality and user satisfaction.
**Build time estimate:** 4-5 weeks

#### 5A: Explanation Depth Slider
```
User profile field: explanation_depth: 'eli5' | 'beginner' | 'intermediate' | 'expert'
LessonGenerator prompt injection:
  eli5:         "Use simple analogies. No jargon. Assume no programming background."
  beginner:     "Use basic terms. Introduce concepts step by step."
  intermediate: "Use standard vocabulary. Mention tradeoffs briefly."
  expert:       "Skip fundamentals. Focus on non-obvious behavior and edge cases."

UI: Slider in settings + quick-toggle in lesson view
    Allow re-generating current lesson at different depth on-demand
```

#### 5B: Concept Dependency Knowledge Graph
```
New table: concepts (id, name, description)
New table: concept_dependencies (concept_id, requires_concept_id)
New table: lesson_concepts (lesson_id, concept_id)

On lesson generation:
  Call Gemini: "Extract 3-5 key concepts from this lesson.
                For each concept, list 2-3 prerequisite concepts."
  Store in graph tables

On lesson view:
  Show: "Before this lesson, you should know: [X, Y, Z]"
  Green = user has lesson covering that concept
  Red = gap detected → click to auto-generate lesson for that concept

Future: full learning path visualization (D3.js force graph)
```

#### 5C: AI Validation Layer
```
After Gemini generates lesson:
  Second Gemini call: "Review this lesson for accuracy.
                       Check: does the code run without errors?
                       Does the explanation match the code?
                       Are there any factual errors?
                       Return: { valid: bool, issues: string[], confidence: 0-1 }"

If confidence < 0.7: show warning badge "This lesson was flagged for review"
If issues found: show inline warnings next to specific steps
Community flag button: "Report inaccuracy" → queues for human review
```

#### 5D: Aha Moment Capture
```
Frontend telemetry (privacy-respecting, opt-in):
  - time_on_step: seconds spent per lesson step
  - replay_count: times user re-ran the code snippet
  - quiz_attempts: attempts before correct answer
  - hesitation_time: ms before selecting quiz option

Pattern: slow read + wrong attempt + correct answer + re-read → aha signal
When detected:
  - Mark this lesson step as anchor: { is_anchor: true, aha_date: now }
  - Weight this card 2x in FSRS scheduler
  - Surface the explanation that caused the click, not just the code
  - Show in analytics: "Concepts that clicked for you"
```

---

### Phase 6: The Network Effect
**Why third:** Need users + validated lessons before community features have value.
**Build time estimate:** 6-8 weeks

#### 6A: Platform Expansion
```
content.js currently matches: ChatGPT, Claude, Gemini
Add matchers for:
  - Cursor AI (sidebar code suggestions - class: .cursor-suggestion)
  - GitHub PR comments (class: .comment-body pre)
  - Stack Overflow answers (class: .answer pre code)
  - Any page (add "Capture this code" context menu item via background.js)

This is pure distribution. Every code explanation on the web becomes a lesson candidate.
```

#### 6B: Community Lesson Library
```
New table: lesson_visibility: 'private' | 'public' | 'community'
New table: lesson_votes (lesson_id, user_id, value: 1 | -1)
New table: lesson_forks (original_lesson_id, forked_lesson_id, forked_by)

Public lessons: shareable URL /lessons/[id]
Community page: browse by concept, sort by upvotes
Fork: copy lesson to your library, annotate it

Effect: Best explanation of "JWT refresh tokens" rises to top.
        Hallucinated lessons get downvoted and flagged.
        This is how the AI accuracy problem self-corrects over time.
```

#### 6C: Employability Gap Analysis
```
User inputs: target job role (or paste job description)
Backend:
  1. Extract required skills from job description (Gemini)
  2. Compare against user's concept knowledge graph
  3. Calculate coverage percentage per skill area
  4. Generate: top 5 gaps + auto-create lessons for each

Output: "For a mid-level React developer role:
         - React hooks: 85% covered ✅
         - TypeScript generics: 20% covered ⚠️ [Generate lessons]
         - Testing (Jest/RTL): 0% covered ❌ [Generate lessons]"

This is the killer Pro tier feature. Most likely reason someone pays $12/mo.
```

#### 6D: GitHub Codebase Reader
```
Input: GitHub file URL
Backend:
  1. Fetch raw file (GitHub API)
  2. Parse: identify top 3 most complex functions (cyclomatic complexity)
  3. For each function, Gemini generates "Reading Code" lesson:
     - What is this function doing?
     - What design pattern is this?
     - What does it assume about its caller?
     - What would break if you changed X?

This teaches the skill Codecademy never touched: reading real, messy, production code.
```

---

### Monetization Infrastructure
**When:** After Phase 4 is live and users feel the retention value.

```
Free tier:
  - Capture + generate: unlimited
  - Lessons saved: 20 lifetime
  - No spaced repetition (show teaser: "3 concepts due for review - upgrade to unlock")
  - No depth slider
  - No analytics

Pro ($12/mo):
  - Unlimited lessons
  - Full spaced repetition engine
  - Depth slider (4 levels)
  - Learning analytics dashboard
  - Misconception micro-lessons
  - Knowledge graph

Team ($49/seat/mo):
  - Everything in Pro
  - Shared team lesson library
  - Admin dashboard (who has learned what)
  - Custom lesson templates
  - API access
  - Bootcamp/onboarding use case

Enterprise (custom):
  - White label
  - SSO/SAML
  - LMS integration (Canvas, Moodle)
  - SLA + support
```

---

## TECHNICAL ARCHITECTURE FOR NEW FEATURES

### New DB Tables Needed
```sql
-- Spaced repetition
CREATE TABLE review_cards (
    id UUID PRIMARY KEY,
    lesson_id UUID REFERENCES lessons(id),
    user_id UUID REFERENCES users(id),
    stability FLOAT DEFAULT 1.0,      -- FSRS param
    difficulty FLOAT DEFAULT 5.0,     -- FSRS param  
    due_date TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    review_count INT DEFAULT 0,
    lapse_count INT DEFAULT 0
);

-- Concept graph
CREATE TABLE concepts (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE concept_dependencies (
    concept_id UUID REFERENCES concepts(id),
    requires_concept_id UUID REFERENCES concepts(id),
    PRIMARY KEY (concept_id, requires_concept_id)
);

CREATE TABLE lesson_concepts (
    lesson_id UUID REFERENCES lessons(id),
    concept_id UUID REFERENCES concepts(id),
    PRIMARY KEY (lesson_id, concept_id)
);

-- Community features
ALTER TABLE lessons ADD COLUMN visibility TEXT DEFAULT 'private';
ALTER TABLE lessons ADD COLUMN fork_count INT DEFAULT 0;

CREATE TABLE lesson_votes (
    lesson_id UUID REFERENCES lessons(id),
    user_id UUID REFERENCES users(id),
    value SMALLINT CHECK (value IN (1, -1)),
    PRIMARY KEY (lesson_id, user_id)
);

-- Aha moments
ALTER TABLE lessons ADD COLUMN is_anchor BOOLEAN DEFAULT FALSE;
ALTER TABLE lessons ADD COLUMN aha_captured_at TIMESTAMPTZ;

-- Subscriptions
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMPTZ;
```

### New API Endpoints
```
POST /api/review/complete        # Submit review rating → FSRS update
GET  /api/review/due             # Cards due today
POST /api/lessons/micro-generate # Misconception micro-lesson
POST /api/concepts/extract       # Extract concepts from lesson
GET  /api/concepts/graph         # User's full knowledge graph
POST /api/lessons/:id/public     # Make lesson public
GET  /api/lessons/community      # Browse community lessons
POST /api/lessons/:id/vote       # Upvote/downvote
POST /api/execute                # Code execution (Judge0 proxy)
POST /api/jobs/analyze           # Job description gap analysis
POST /api/github/analyze         # GitHub URL lesson generation
POST /api/stripe/webhook         # Stripe events
POST /api/subscribe              # Create subscription
```

---

## COMPETITIVE POSITIONING

```
                    SYNTHETIC ←————————————→ CONTEXTUAL
                         |                        |
          HIGH   Brilliant                    VibeCode
        DEPTH    (problem sets)             (your real code)
                         |                        |
          LOW    Codecademy                 Khan Academy
        DEPTH    (fake exercises)          (video watching)
```

VibeCode is the only product in the "high depth + contextual" quadrant.

Nobody else teaches you from your own confusion, in the moment it happens, at the depth you need.

---

## WHAT TO BUILD FIRST (AND WHY)

Both `p4-fsrs` and `p4-code-runner` are unblocked and can start immediately.

**Start with code execution.**

Reason: It's visible. It makes existing lessons dramatically better immediately. Users who are already signed up will notice. It creates a demo moment ("watch me click Run and this Python runs in the browser"). FSRS is invisible until users have lessons to review (they need ~2 weeks of capturing before review queue fills up).

So the order is:
1. **Code execution** (Pyodide + iframe) — immediate visible value
2. **FSRS** — starts building the review queue in parallel
3. **Review UI** — becomes useful 2 weeks after FSRS is collecting data
4. **Misconception micro-lessons** — improves quiz experience immediately
5. **Depth slider** — unlocks Pro tier conversion
6. **Knowledge graph** — foundation for everything in Phase 6
7. **Stripe** — monetize after value is proven

---

## THE ONE METRIC THAT MATTERS

Not DAU. Not lessons generated. Not signups.

**Day-30 retention.** 

If 30% of users who sign up are still using VibeCode 30 days later, you have something. That's a healthy B2C learning app.
If it's below 10%, the retention loop isn't working and nothing else matters.
Everything in Phase 4 is designed to move that number.
