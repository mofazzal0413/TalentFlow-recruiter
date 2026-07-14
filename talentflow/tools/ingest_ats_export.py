"""Parse ATS export files (JSON or CSV) into screening criteria."""

from __future__ import annotations

import csv
import io
import json
import re
from typing import Any

from talentflow.tools.ingest_job_description import ingest_job_description


def _split_list_field(value: str) -> list[str]:
    if not value or not value.strip():
        return []
    parts = re.split(r"[|;]", value)
    return [part.strip() for part in parts if part.strip()]


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    must_have = record.get("must_have") or record.get("mustHave") or record.get("required_skills")
    nice_to_have = record.get("nice_to_have") or record.get("niceToHave") or record.get("preferred_skills")

    if isinstance(must_have, str):
        must_have = _split_list_field(must_have)
    if isinstance(nice_to_have, str):
        nice_to_have = _split_list_field(nice_to_have)

    return {
        "job_id": record.get("job_id") or record.get("id") or record.get("jobId"),
        "title": record.get("title") or record.get("role") or "",
        "level": record.get("level") or "",
        "description": record.get("description") or record.get("job_description") or "",
        "must_have": list(must_have or []),
        "nice_to_have": list(nice_to_have or []),
    }


def _parse_json_export(content: str) -> dict[str, Any]:
    payload = json.loads(content)
    if isinstance(payload, list):
        if not payload:
            raise ValueError("ATS export JSON array is empty.")
        return _normalize_record(payload[0])
    if not isinstance(payload, dict):
        raise ValueError("ATS export JSON must be an object or array of objects.")
    return _normalize_record(payload)


def _parse_csv_export(content: str) -> dict[str, Any]:
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        raise ValueError("ATS export CSV has no data rows.")
    return _normalize_record(rows[0])


def parse_ats_export(content: str, filename: str = "") -> dict[str, Any]:
    """Parse ATS export content from JSON or CSV."""
    trimmed = content.strip()
    if not trimmed:
        raise ValueError("ATS export file is empty.")

    lowered = filename.lower()
    if lowered.endswith(".csv"):
        return _parse_csv_export(trimmed)
    if lowered.endswith(".json"):
        return _parse_json_export(trimmed)

    if trimmed.startswith("{") or trimmed.startswith("["):
        return _parse_json_export(trimmed)

    return _parse_csv_export(trimmed)


def build_requirements_override(
    parsed: dict[str, Any],
    *,
    source: str = "ats_export",
    imported_at: str | None = None,
) -> dict[str, Any]:
    """Turn parsed ATS data into a per-job override record."""
    must_have = list(parsed.get("must_have") or [])
    nice_to_have = list(parsed.get("nice_to_have") or [])

    if not must_have and parsed.get("description"):
        ingested = ingest_job_description(
            description=parsed["description"],
            title=parsed.get("title", ""),
            level=parsed.get("level", ""),
        )
        must_have = ingested.get("must_have", [])
        nice_to_have = ingested.get("nice_to_have", [])

    override: dict[str, Any] = {
        "source": source,
        "must_have": must_have,
        "nice_to_have": nice_to_have,
    }
    if imported_at:
        override["imported_at"] = imported_at
    return override
