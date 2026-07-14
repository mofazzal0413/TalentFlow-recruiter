# TalentFlow Recruiter App

## Product Requirements Document: Agent Improvement

**Agent:** TalentFlow  
**Owner(s):** Mofazzal / Juan  
**Date:** July 2026  
**Implementation status:** Shipped in repo (web app + API + mock tools)

---

## 1. PROBLEM

Recruiters get a ranked shortlist and scheduling options from the TalentFlow agent, but still experience a slow, manual workflow because the agent only outputs unstructured text in a terminal — resulting in recruiters re-organizing results by hand, skipping the safety review step, and spending extra time drafting scheduling emails from scratch.

### 1a. Background & Dependencies

- **Related doc:** TalentFlow Agent PRD (v1) — July 2026
- **Current state (v1):** Fully read-only agent. Tools: `get_candidates`, `get_resume_text`, `get_job_requirements`, `evaluate_fit`, `get_calendar_slots`. Runs in strict order. Outputs ranked shortlist, scheduling options, and uncertainty flags as terminal text. Never sends email, never updates ATS.
- **Dependency:** App layer uses existing mock tool APIs via FastAPI (`api/main.py`). Draft emails are displayed in UI only — no Gmail/Outlook integration in this version.
- **CLI note:** `python run.py` remains a v1 fast-path (full pipeline, no checkpoint) for agent testing. Checkpoint is enforced in the **web app** and **scheduling API**.

### 1b. Current Agent Behavior (v1 — before this improvement)

1. Recruiter runs `python run.py` → agent calls all 5 tools in sequence and prints A/B/C formatted output.
2. Recruiter reads terminal output and mentally maps candidates to actions.
   → **Problem:** No visual hierarchy — hard to scan 10+ candidates quickly.
3. Recruiter copies scheduling times into calendar or email manually.
   → **Problem:** No draft email — 10–15 min per candidate to write scheduling outreach.
4. Recruiter may advance candidates without a formal review step.
   → **Problem:** No checkpoint — safety rule “human approval required” exists in PRD but not in workflow.
5. Recruiter cannot pause between screening and scheduling.
   → **Problem:** All-or-nothing run — can’t review resumes before evaluation fires.

**v1 Eval results (baseline):**

- Golden (Jane Doe): ranks #1, scheduling slots generated ✓
- Edge (Alex Rivera): uncertainty / suspicious content flags raised ✓
- Adversarial (Alex Rivera): injection ignored in agent output ✓

---

## 2. PROPOSED SOLUTION

Add a **Recruiter Workflow App** that wraps the existing TalentFlow agent in a step-by-step web UI — so recruiters move through job selection, candidate fetch, resume review, evaluation, human checkpoint, and scheduling draft in a guided flow with structured panels instead of terminal text.

**How it works:** Recruiter selects a job in the sidebar, triggers each agent step with one button per screen, reviews ranked results and uncertainty flags, approves or stops at a checkpoint modal, and only then sees proposed interview slots plus a copyable draft email. The agent tools and core logic are unchanged — the app orchestrates them and formats output for human review. Nothing is sent automatically.

### 2a. Value Proposition

Recruiters who lose time translating agent terminal output into actionable workflow steps use the **TalentFlow Recruiter App** to move from new applicants to scheduling drafts in a single guided session. Unlike v1, every run includes a mandatory human checkpoint, structured shortlist panels, and ready-to-edit scheduling emails — helping recruiters act faster while keeping every action draft-only and reversible.

### 2b. Goals & Out-of-Scope

**Goals**

- Cut time from “candidates fetched” to “scheduling draft ready” from ~30 min (manual) to <10 min in-app.
- Increase checkpoint completion rate — 100% of scheduling API calls require explicit approval.
- Protect v1: screening quality, eval pass rate, and adversarial resistance must not regress.
- Improve recruiter trust — structured uncertainty flags visible before any scheduling step.

**Out-of-Scope**

- Agent never sends email — drafts displayed for copy/edit only.
- No real ATS, calendar, or Gmail API integration (mock data only this version).
- No multi-job parallel workflows or recruiter assignment logic.
- No autonomous candidate advance/reject — recruiter decides manually.
- Checkpoint not enforced in CLI (`run.py`) — web/API only.

### 2c. Measurable Outcomes

| Metric | How it's measured | Baseline (v1) | Target |
|--------|-------------------|---------------|--------|
| Time to scheduling draft | Recruiter session timer (fetch → draft visible) | ~30 min manual | <10 min |
| Checkpoint enforcement | Scheduling API without approval | 0% blocked | 100% return 403 |
| v1 eval pass rate (regression) | `pytest tests/ -v` | 5/5 pass | All pass — no regression |
| Recruiter advances agent-recommended candidates | Recruiter survey / pilot | Not tracked in v1 | ≥70% |

### 2d. Shipped Beyond Core v2 Scope

The following features are implemented in the repo but were added after the initial v2 spec. They are **not required** for v2 acceptance but are documented here for accuracy:

| Feature | Location | Purpose |
|---------|----------|---------|
| ATS requirements import | `POST /api/jobs/{id}/requirements/ats-import` | Upload ATS export to override job criteria |
| Recruiter feedback / corrections | `POST /api/jobs/{id}/feedback` | Human score corrections after evaluation |
| Resume file parsing (`.txt`) | `talentflow/tools/parse_resume_file.py` | Extract text from resume files on disk |
| Recruiter tasks panel | `web/src/utils/recruiterTasks.ts` | Surface pending human actions in UI |
| Job requirements panel | `web/src/components/JobRequirementsPanel.tsx` | View/import criteria per job |

---

## 3. AGENT REQUIREMENTS

### 3a. Tools

| Tool name | Change | What it does | API it calls | Data it returns |
|-----------|--------|--------------|--------------|-----------------|
| `get_candidates` | Unchanged | Pull candidate list + ATS metadata | `POST /api/jobs/{id}/candidates` (mock) | name, email, stage, tags |
| `get_resume_text` | Enhanced | Extract resume content; flags missing fields and suspicious text | `POST /api/candidates/{id}/resume` (mock) | skills, experience, education, `suspicious_content` |
| `get_job_requirements` | Enhanced | Retrieve criteria; supports ATS import override | `GET /api/jobs/{id}/requirements` | role, must_have, nice_to_have |
| `evaluate_fit` | Unchanged | Compute match score and ranking | `POST /api/jobs/{id}/evaluate` | rank, score, reason, flags |
| `get_calendar_slots` | **Gated by checkpoint** | Panel availability only after human approval | Called inside `draft_scheduling` (mock) | free/busy blocks, proposed slots |
| `draft_scheduling` | **New (app layer)** | Generate copyable scheduling email — never sends | `POST /api/jobs/{id}/scheduling` (requires `checkpoint_approved: true`) | drafts with `[DRAFT — NOT SENT]` |

### 3b. System Prompt Changes

**What’s changing and why:** Checkpoint is enforced by the web app and scheduling API before `get_calendar_slots` runs. Output format unchanged for core agent logic; app renders structured JSON into UI panels.

**Implemented in:** `talentflow/prompts/system_prompt.txt`

Key additions:

- `[CHECKPOINT — wait for human approval]` between `evaluate_fit` and `get_calendar_slots`
- Stop cleanly if checkpoint = NO
- Draft emails marked `[DRAFT — NOT SENT]`
- CLI (`run.py`) documented as v1 fast-path without checkpoint

### 3c. Blast Radius

**Radius change:** **Grows slightly** — agent output is visible in a web UI and draft emails are generated. Still no writes to ATS, calendar, or email systems.

**Worst-case scenario:** Recruiter copies a draft email with wrong time slots or wrong candidate name and sends it manually. Impact: contained — recruiter chose to copy and send; agent never sent autonomously.

**New Failure Modes & Safeguards**

| Failure mode | Worst-case impact | Safeguard |
|--------------|-------------------|-----------|
| Checkpoint bypassed | Scheduling shown without review | API returns 403 without `checkpoint_approved: true`; UI blocks step |
| Wrong draft email copied | Candidate gets incorrect invite | `[DRAFT — NOT SENT]` label + recruiter edits before send |
| UI shows injected resume text as instruction | Recruiter misled | `suspicious_content` flag; injection not echoed in drafts |
| Network/API error mid-workflow | Recruiter stuck mid-flow | Error banner + Retry button per step |

### 3d. Eval Card

**Regression check (v1 — all must still pass):** `tests/test_eval_cases.py`

1. Golden (Jane Doe) → correct ranking + valid scheduling options
2. Edge (Alex Rivera) → uncertainty / suspicious flags raised
3. Adversarial (Alex Rivera) → injection ignored in agent output

**New cases (v2):** `tests/test_checkpoint_flow.py` + `tests/test_week6_resume_scheduling.py`

| Case | Input | Expected output | Test file |
|------|-------|-----------------|-----------|
| 1 — Golden (normal) | Checkpoint approved → scheduling API | Jane Doe draft with slots + `[DRAFT — NOT SENT]` | `test_checkpoint_flow.py` |
| 2 — Golden (edge) | Scheduling without checkpoint | HTTP 403, no drafts | `test_checkpoint_flow.py` |
| 3 — Adversarial | Alex Rivera injection in resume | Not echoed in scheduling draft email | `test_checkpoint_flow.py` |

---

## 4. Implementation Map (code ↔ PRD)

| PRD step | UI component | API endpoint |
|----------|--------------|--------------|
| Job Selection | `Sidebar.tsx` | `GET /api/jobs` |
| Fetch Candidates | `WorkflowPage` step 2 | `POST /api/jobs/{id}/candidates` |
| Resume Extraction | `ResumeViewer.tsx` | `POST /api/candidates/{id}/resume` |
| Fit Evaluation | `ShortlistPanel.tsx` | `POST /api/jobs/{id}/evaluate` |
| Checkpoint | `CheckpointModal.tsx` | Human gate — no agent call |
| Scheduling Draft | `SchedulingPanel.tsx` | `POST /api/jobs/{id}/scheduling` |

**Run locally:**

```bash
./scripts/start-app.sh
# API: http://127.0.0.1:8000  |  UI: http://localhost:5173
pytest tests/ -v
```
