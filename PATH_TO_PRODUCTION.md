# Path to Production

Written 2026-07-18, the day before the Cycle 3 presentation. This is **not** a
demo-readiness checklist — the app is demo-ready as-is (Eval Card passes, 49
tests green, checkpoint gate enforced). This is what would actually need to
happen before selling TalentFlow to a real recruiting agency as a paying
product, in priority order. Come back to this after the presentation.

Each item below is a gap, not a criticism — the README already documents
these honestly rather than hiding them (see "Known limitations" and the
run-to-run variance section). This doc is the "what do I do about it" that
sits next to that "here's what's true today."

---

## 1. Legal/compliance exposure (do this first — it's the deal-killer)

AI-driven hiring decisions are regulated in real jurisdictions:

- **NYC Local Law 144** requires an independent bias audit before an
  "automated employment decision tool" can be used in hiring, plus public
  disclosure of the audit results.
- **EU AI Act** classifies hiring AI as "high-risk," with its own conformity
  and documentation requirements.
- Most US states are moving toward similar disclosure/audit requirements.

**What's needed, concretely:**
- A bias-testing harness that runs the same resume through the screener with
  demographic signals varied (name, school, gender-coded language) and
  measures score drift — the Eval Card's 3 cases are nowhere near enough
  evidence for this; this needs a real statistical sample.
- A documented methodology for that audit (what was tested, what wasn't,
  what the results were) that could survive an actual legal review.
- A clear, written policy on what the tool does and doesn't decide
  automatically (this repo's checkpoint gate is a good start — it needs to be
  described in a way legal/compliance teams recognize, not just recruiter UX
  copy).

This is the item most likely to end a sales conversation early if skipped —
tackle it before investing further in the other four.

## 2. Real ATS integration

Candidates and resumes currently come from mock JSON files in `data/`
(`get_candidates`, `get_resume_text`). An agency needs this pulling from a
live ATS.

**What's needed, concretely:**
- Pick one real ATS to integrate first (Greenhouse and Lever both have
  documented REST APIs and webhooks) rather than trying to support many at
  once.
- Replace `talentflow/tools/get_candidates.py` / `get_resume_text.py`'s data
  source with a real API client, keeping the same return contract so nothing
  downstream (`evaluate_fit`, the UI) needs to change.
- Handle real-world resume messiness: scanned PDFs, multiple file formats,
  resumes with no machine-readable text at all — `resumeExtractor.ts` /
  `skillParser.ts` were built against clean mock text, not real uploads.
- Webhooks or polling for new applicants, instead of the current "click
  Fetch Candidates" pull model.

## 3. Auth + multi-tenancy

No login exists today; there's one implicit "user" and no data isolation
between agencies or recruiters.

**What's needed, concretely:**
- Basic auth (even something simple like session-based login to start).
- Per-agency data scoping everywhere `data/*.json` is currently read/written
  globally — jobs, candidates, feedback, evaluation cache all need an
  agency/org ID dimension.
- Per-recruiter attribution on feedback corrections and checkpoint approvals
  (`get_feedback` / `submit_feedback` currently don't track *who* submitted
  a correction — that becomes a real requirement once more than one person
  uses this).

## 4. A real audit trail

There's already a decent foundation: `vote_log.jsonl` logs every LLM
screening vote with cost/latency, and `data/feedback.json` logs recruiter
corrections. Neither is currently built to be *queried* or *relied on* for
compliance — they're debug logs, gitignored, local files.

**What's needed, concretely:**
- Move from local JSONL/JSON files to a real database table: one row per
  AI decision (candidate, job, verdict, score, model version, timestamp) and
  one row per human action (checkpoint approval/rejection, feedback
  correction, who did it, when).
- Make this queryable — "show me every decision this tool made for this
  candidate, and every time a human overrode it" needs to be a real report,
  not a grep through a JSONL file.
- Retention policy — how long is this kept, and is candidate PII in it
  handled the way hiring data actually needs to be (this ties into #1 too).

## 5. Hosting / SLA

This runs on a laptop, with `data/evaluation_cache.json` as a local file
that "won't survive a fresh clone or a wiped `data/` directory" (README's own
words). Selling this means it needs to run reliably for someone else.

**What's needed, concretely:**
- Real database instead of flat JSON files in `data/` (ties directly into
  #3 and #4 above — same underlying change covers all three).
- Actual hosting (not `./scripts/start-app.sh` on a dev machine) with
  monitoring and backups.
- A real deployment/versioning story so a bug fix doesn't mean re-cloning
  the repo on someone's laptop.

---

## Suggested order

1. Bias audit methodology (legal risk — blocks everything else if wrong)
2. Real ATS integration (proves the product actually works on real data)
3. Database migration (unlocks #3 auth/multi-tenancy and #4 audit trail
   together, since they're the same underlying change)
4. Auth + multi-tenancy
5. Audit trail reporting UI
6. Hosting/SLA hardening

Everything here is deliberately **not** urgent for tomorrow. The demo,
Eval Card, and README's honest limitations section are the right level of
maturity for a Cycle 3 presentation — this document exists so that
"what's next" has a real answer instead of a vague one, whenever you pick
this back up.
