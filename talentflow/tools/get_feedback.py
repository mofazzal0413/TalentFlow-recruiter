"""Retrieve recruiter scorecards and evaluation comments."""

from __future__ import annotations

from typing import Any

from talentflow.tools._data import load_json, save_json


def get_feedback(
    job_id: str | None = None,
    candidate_id: str | None = None,
) -> list[dict[str, Any]]:
    entries = load_json("feedback.json").get("entries", [])
    if job_id:
        entries = [e for e in entries if e.get("job_id") == job_id]
    if candidate_id:
        entries = [e for e in entries if e.get("candidate_id") == candidate_id]
    return entries


def submit_feedback(payload: dict[str, Any]) -> dict[str, Any]:
    data = load_json("feedback.json")
    entries = data.get("entries", [])
    entry = {
        "id": f"fb_{len(entries) + 1:03d}",
        "job_id": payload["job_id"],
        "candidate_id": payload["candidate_id"],
        "candidate_name": payload.get("candidate_name", ""),
        "scorecard": payload.get("scorecard", {}),
        "comment": payload.get("comment", "").strip(),
        "corrected_match_score": payload.get("corrected_match_score"),
        "corrected_meets_bar": payload.get("corrected_meets_bar"),
        "submitted_at": payload.get("submitted_at"),
    }
    if not entry["comment"] and entry["corrected_match_score"] is None:
        raise ValueError("Feedback requires a comment or corrected match score.")
    entries.append(entry)
    save_json("feedback.json", {"entries": entries})
    return entry
