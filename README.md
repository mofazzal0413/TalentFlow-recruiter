# TalentFlow

AI agent for Talent Acquisition that screens candidates, ranks them by fit, and drafts interview scheduling options.

## What it does

- Pulls candidate data from ATS and resumes into one structured view
- Evaluates candidates against job requirements
- Produces a ranked shortlist with match scores and reasoning
- Drafts scheduling options based on calendar availability

All output is draft-only — recruiters review and decide before anything is sent.

## Project structure

```
talentflow/
├── api/                    # FastAPI backend
├── data/                   # Mock ATS, resume, calendar data
├── scripts/start-app.sh    # Run API + web UI together
├── talentflow/             # Python agent + tools
├── tests/                  # Agent eval cases
├── web/                    # React UI
├── run.py                  # CLI agent runner
├── README.md
└── requirements.txt
```

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd web && npm install
```

## Run the app

**Option A — both servers:**
```bash
chmod +x scripts/start-app.sh
./scripts/start-app.sh
```

**Option B — separate terminals:**
```bash
# Terminal 1 — API
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000

# Terminal 2 — UI
cd web && npm run dev
```

Open http://localhost:5173

## Run the CLI agent

```bash
python run.py          # v1 fast-path — full pipeline, no checkpoint
pytest tests/ -v       # v1 regression + v2 checkpoint tests
```

The CLI agent skips the human checkpoint for fast testing. Use the web app for the full PRD v2 workflow with checkpoint enforcement.

## App workflow

1. **Job Selection** — pick a role from the sidebar
2. **Fetch Candidates** — `get_candidates`
3. **Resume Extraction** — `get_resume_text` per candidate
4. **Fit Evaluation** — `evaluate_fit`
5. **Checkpoint** — human YES/NO before scheduling
6. **Scheduling Draft** — `get_calendar_slots` + draft email (not sent)

## Status

Web app + agent implemented with mock data. Ready for Pursuit-style integrations.

## Owners

Mofazzal / Juan — July 2026
