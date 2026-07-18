"""Structured orchestration for the TalentFlow app."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from talentflow.agent import _clarification_for
from talentflow.tools import (
    get_calendar_slots,
    get_candidates,
    get_feedback,
    get_job_requirements,
    get_resume_text,
    submit_feedback,
)
from talentflow.tools.evaluate_fit_talentflow_agent import evaluate_fit_llm as evaluate_fit
from talentflow.tools._data import DATA_DIR, load_json, save_json
from talentflow.tools.ingest_ats_export import build_requirements_override, parse_ats_export
from talentflow.validators.agent_output import (
    validate_calendar_slots,
    validate_draft_email,
    validate_resume,
    validate_shortlist,
)


def list_jobs() -> list[dict[str, Any]]:
    """Return normalized job records for the jobs API."""
    jobs = load_json("jobs.json")
    candidates = load_json("candidates.json")
    counts: dict[str, int] = {}
    for candidate in candidates:
        job_id = candidate.get("job_id")
        if job_id:
            counts[job_id] = counts.get(job_id, 0) + 1

    return [
        {
            "id": job["id"],
            "title": job["title"],
            "department": job["department"],
            "location": job["location"],
            "level": job["level"],
            "description": job.get("description", ""),
            "status": job.get("status", "open"),
            "candidate_count": counts.get(job["id"], 0),
        }
        for job in jobs
    ]


def get_job(job_id: str) -> dict[str, Any]:
    for job in list_jobs():
        if job["id"] == job_id:
            return job
    raise ValueError(f"Job not found: {job_id}")


def fetch_candidates(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    candidates = get_candidates(job_id)
    return {
        "job": job,
        "candidates": [
            {
                **candidate,
                "email": candidate.get("email", "—"),
                "status": candidate.get("stage", "unknown"),
            }
            for candidate in candidates
        ],
    }


def extract_resume(candidate_id: str) -> dict[str, Any]:
    resume = get_resume_text(candidate_id)
    missing_flags: list[str] = []

    if not resume.get("skills"):
        missing_flags.append("No skills listed")
    if not resume.get("experience"):
        missing_flags.append("No work experience listed")
    if not resume.get("education"):
        missing_flags.append("No education listed")
    if resume.get("error"):
        missing_flags.append(resume["error"])
    if resume.get("suspicious_content"):
        missing_flags.append("Suspicious content detected")
    for field in resume.get("missing_fields", []):
        label = f"No {field} listed"
        if label not in missing_flags:
            missing_flags.append(label)

    validate_resume(resume)

    return {
        "candidate_id": candidate_id,
        "resume": resume,
        "missing_flags": missing_flags,
    }


def fetch_job_requirements(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    requirements = get_job_requirements(job_id)
    return {"job": job, **requirements}


def import_ats_export(job_id: str, content: bytes, filename: str) -> dict[str, Any]:
    """Import ATS export file and persist per-job screening criteria."""
    _get_job(job_id)

    try:
        parsed = parse_ats_export(content.decode("utf-8"), filename)
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError(f"Invalid ATS export: {error}") from error

    export_job_id = parsed.get("job_id")
    if export_job_id and export_job_id != job_id:
        raise ValueError(
            f"ATS export job_id '{export_job_id}' does not match route job '{job_id}'."
        )

    if parsed.get("description") or parsed.get("title") or parsed.get("level"):
        jobs = load_json("jobs.json")
        for item in jobs:
            if item.get("id") == job_id:
                if parsed.get("description"):
                    item["description"] = parsed["description"]
                if parsed.get("title"):
                    item["title"] = parsed["title"]
                if parsed.get("level"):
                    item["level"] = parsed["level"]
                break
        save_json("jobs.json", jobs)

    imported_at = datetime.now(UTC).isoformat()
    override = build_requirements_override(parsed, imported_at=imported_at)

    overrides_path = DATA_DIR / "job_requirements_by_job.json"
    overrides: dict[str, Any] = {}
    if overrides_path.exists():
        overrides = load_json("job_requirements_by_job.json")
    overrides[job_id] = override
    save_json("job_requirements_by_job.json", overrides)

    job = _get_job(job_id)
    requirements = get_job_requirements(job_id)
    return {
        "job": job,
        **requirements,
        "import_summary": {
            "filename": filename,
            "imported_at": imported_at,
            "criteria_count": len(requirements.get("must_have", [])) + len(requirements.get("nice_to_have", [])),
        },
    }


def fetch_feedback(job_id: str, candidate_id: str | None = None) -> dict[str, Any]:
    job = _get_job(job_id)
    return {"job": job, "feedback": get_feedback(job_id=job_id, candidate_id=candidate_id)}


def save_feedback_correction(
    job_id: str,
    candidate_id: str,
    candidate_name: str,
    comment: str,
    corrected_match_score: int | None = None,
    corrected_meets_bar: bool | None = None,
    scorecard: dict[str, int] | None = None,
) -> dict[str, Any]:
    _get_job(job_id)
    return submit_feedback(
        {
            "job_id": job_id,
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "comment": comment,
            "corrected_match_score": corrected_match_score,
            "corrected_meets_bar": corrected_meets_bar,
            "scorecard": scorecard or {},
            "submitted_at": datetime.now(UTC).isoformat(),
        }
    )


_EVALUATION_CACHE_FILENAME = "evaluation_cache.json"


def _load_evaluation_cache() -> dict[str, Any]:
    try:
        return load_json(_EVALUATION_CACHE_FILENAME)
    except FileNotFoundError:
        return {}


def run_evaluation(
    candidates: list[dict[str, Any]],
    resumes: dict[str, dict[str, Any]],
    job_id: str,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Ranks candidates via evaluate_fit (the live voting LLM screener — see
    evaluate_fit_talentflow_agent.py), then applies cheap, deterministic
    per-request logic (feedback corrections, uncertainty flags, shortlist
    validation) on top.

    Only the expensive evaluate_fit call itself is cached, keyed by job_id,
    in evaluation_cache.json (gitignored — holds real candidate resume/eval
    data) — not the whole result — so a recruiter's feedback corrections
    submitted after a cached evaluation still show up on every request
    rather than going stale. force_refresh=True (or no prior cache entry
    for this job_id) re-runs evaluate_fit live and overwrites the cache.
    """
    job = _get_job(job_id)
    job_requirements = get_job_requirements(job_id)

    cache = _load_evaluation_cache()
    cached_entry = cache.get(job_id)

    if cached_entry is not None and not force_refresh:
        ranked = cached_entry["ranked"]
        cache_info = {"cached": True, "evaluated_at": cached_entry["evaluated_at"]}
    else:
        ranked = evaluate_fit(candidates, resumes, job_requirements)
        evaluated_at = datetime.now(UTC).isoformat()
        cache[job_id] = {"evaluated_at": evaluated_at, "ranked": ranked}
        save_json(_EVALUATION_CACHE_FILENAME, cache)
        cache_info = {"cached": False, "evaluated_at": evaluated_at}

    ranked = _apply_feedback_corrections(ranked, get_feedback(job_id=job_id))

    uncertainty_flags = []
    for result in ranked:
        for issue in result.get("uncertainty_flags", []):
            uncertainty_flags.append(
                {
                    "issue": issue,
                    "candidate": result["name"],
                    "candidate_id": result["candidate_id"],
                    "clarification_needed": _clarification_for(issue),
                }
            )

    borderline = [
        result
        for result in ranked
        if not result["meets_bar"] and result["match_score"] >= 40
    ]

    shortlist = validate_shortlist(ranked)
    borderline_candidates = validate_shortlist(borderline)
    strong_candidates = validate_shortlist([result for result in ranked if result["meets_bar"]])

    return {
        "job": job,
        "shortlist": shortlist,
        "borderline_candidates": borderline_candidates,
        "uncertainty_flags": uncertainty_flags,
        "strong_candidates": strong_candidates,
        "evaluation_cache": cache_info,
    }


def draft_scheduling(
    job_id: str,
    strong_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    job = _get_job(job_id)
    candidate_ids = [candidate["candidate_id"] for candidate in strong_candidates]
    calendar = get_calendar_slots(candidate_ids)
    validate_calendar_slots(calendar)
    slots = calendar.get("proposed_slots", [])

    drafts = []
    for candidate in strong_candidates:
        email = _candidate_email(candidate["candidate_id"], job_id)
        draft_email = _build_draft_email(
            candidate_name=candidate["name"],
            candidate_email=email,
            job_title=job["title"],
            slots=slots,
        )
        validate_draft_email(draft_email)
        drafts.append(
            {
                "candidate_id": candidate["candidate_id"],
                "name": candidate["name"],
                "email": email,
                "proposed_slots": slots,
                "draft_email": draft_email,
            }
        )

    return {
        "job": job,
        "panel": calendar.get("panel", []),
        "timezone": calendar.get("timezone"),
        "free_blocks": calendar.get("free_blocks", []),
        "drafts": drafts,
    }


def _apply_feedback_corrections(
    ranked: list[dict[str, Any]],
    feedback_entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for entry in feedback_entries:
        cid = entry.get("candidate_id")
        if cid:
            latest[cid] = entry
    for result in ranked:
        correction = latest.get(result["candidate_id"])
        if not correction:
            continue
        if correction.get("corrected_match_score") is not None:
            result["match_score"] = correction["corrected_match_score"]
        if correction.get("corrected_meets_bar") is not None:
            result["meets_bar"] = correction["corrected_meets_bar"]
        if correction.get("comment"):
            result["reason"] = f"{result['reason']} [Recruiter correction: {correction['comment']}]"
    ranked.sort(key=lambda item: item["match_score"], reverse=True)
    for index, result in enumerate(ranked, start=1):
        result["rank"] = index
    return ranked


def _get_job(job_id: str) -> dict[str, Any]:
    return get_job(job_id)


def _candidate_email(candidate_id: str, job_id: str | None = None) -> str:
    for candidate in get_candidates(job_id):
        if candidate["id"] == candidate_id:
            return candidate.get("email", "candidate@email.com")
    return "candidate@email.com"


def _build_draft_email(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    slots: list[str],
) -> str:
    first_name = candidate_name.split()[0]
    slot_lines = "\n".join(f"- {slot}" for slot in slots) if slots else "- TBD"

    return (
        f"To: {candidate_email}\n"
        f"Subject: Interview Invitation — {job_title}\n\n"
        f"Hi {first_name},\n\n"
        f"We would like to invite you to interview for the {job_title} role.\n"
        f"Please let us know which of the following times works best for you:\n\n"
        f"{slot_lines}\n\n"
        f"Best regards,\n"
        f"Talent Acquisition Team\n\n"
        f"[DRAFT — NOT SENT]"
    )
