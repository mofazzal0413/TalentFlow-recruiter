"""Pull candidate list and ATS metadata."""

from __future__ import annotations

from typing import Any

from talentflow.tools._data import load_json


def get_candidates(job_id: str | None = None) -> list[dict[str, Any]]:
    """ATS API mock — GET /candidates."""
    candidates = load_json("candidates.json")
    if job_id is None:
        return candidates
    return [c for c in candidates if c.get("job_id") == job_id]
