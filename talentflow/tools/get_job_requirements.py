"""Retrieve must-have and nice-to-have job criteria."""

from __future__ import annotations

from typing import Any

from talentflow.tools._data import DATA_DIR, load_json
from talentflow.tools.ingest_job_description import ingest_job_description


def get_job_requirements(job_id: str | None = None) -> dict[str, Any]:
    """
    Load screening criteria from job description ingestion (API/DB/ATS data in jobs.json),
    with optional per-job overrides and global fallback.
    """
    base = load_json("job_requirements.json")
    overrides_path = DATA_DIR / "job_requirements_by_job.json"
    overrides: dict[str, Any] = {}
    if overrides_path.exists():
        overrides = load_json("job_requirements_by_job.json")

    if not job_id:
        return base

    jobs = load_json("jobs.json")
    job = next((item for item in jobs if item.get("id") == job_id), None)
    if not job:
        return base

    ingested = ingest_job_description(
        description=job.get("description", ""),
        title=job.get("title", ""),
        level=job.get("level", ""),
    )

    job_override = overrides.get(job_id, {})
    has_override = bool(job_override.get("must_have"))

    if has_override:
        must_have = job_override.get("must_have", [])
        nice_to_have = job_override.get("nice_to_have", [])
        ingestion_source = job_override.get("source", "ats_override")
    else:
        must_have = ingested.get("must_have") or base.get("must_have", [])
        nice_to_have = ingested.get("nice_to_have") or base.get("nice_to_have", [])
        ingestion_source = ingested.get("ingestion_source", "fallback")

    return {
        "job_id": job_id,
        "role": job.get("title", base.get("role", "")),
        "must_have": must_have,
        "nice_to_have": nice_to_have,
        "ingestion_source": ingestion_source,
        "has_override": has_override,
    }
