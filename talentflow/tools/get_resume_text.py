"""Extract resume content for a candidate."""

from __future__ import annotations

import re
from typing import Any

from talentflow.tools._data import DATA_DIR, load_json
from talentflow.tools.parse_resume_file import extract_text_from_file, supported_suffixes

_SUSPICIOUS_PATTERNS = [
    re.compile(r"ignore\s+all\s+previous\s+instructions", re.I),
    re.compile(r"ignore\s+instructions", re.I),
    re.compile(r"you\s+are\s+now\s+in\s+\w+\s+mode", re.I),
    re.compile(r"schedule\s+me\s+immediately", re.I),
    re.compile(r"system\s+prompt", re.I),
]


def detect_suspicious_content(text: str) -> bool:
    """Return True when resume text looks like prompt injection."""
    if not text.strip():
        return False
    return any(pattern.search(text) for pattern in _SUSPICIOUS_PATTERNS)


def _candidate_record(candidate_id: str) -> dict[str, Any] | None:
    candidates = load_json("candidates.json")
    return next((item for item in candidates if item.get("id") == candidate_id), None)


def _load_file_text(resume_link: str) -> tuple[str, str] | None:
    path = DATA_DIR / resume_link
    if not path.exists():
        for suffix in supported_suffixes():
            alt = path.with_suffix(suffix)
            if alt.exists():
                path = alt
                break
        else:
            return None

    try:
        return extract_text_from_file(path), path.suffix.lower().lstrip(".")
    except (OSError, ValueError, RuntimeError):
        return None


def get_resume_text(candidate_id: str) -> dict[str, Any]:
    """Resume parser — reads PDF/DOCX/TXT when available, else structured JSON mock."""
    resumes = load_json("resumes.json")
    candidate = _candidate_record(candidate_id)

    file_text: str | None = None
    file_format: str | None = None
    if candidate and candidate.get("resume_link"):
        loaded = _load_file_text(candidate["resume_link"])
        if loaded:
            file_text, file_format = loaded

    if candidate_id not in resumes and not file_text:
        return {
            "skills": [],
            "experience": [],
            "education": [],
            "error": f"No resume found for candidate_id={candidate_id}",
        }

    resume = dict(resumes.get(candidate_id, {}))
    raw_text = file_text or resume.get("raw_text") or _format_raw_text(resume)
    suspicious = detect_suspicious_content(raw_text)

    return {
        "skills": resume.get("skills", []),
        "experience": resume.get("experience", []),
        "education": resume.get("education", []),
        "raw_text": raw_text,
        "suspicious_content": suspicious,
        "source_format": file_format or ("json" if candidate_id in resumes else "unknown"),
        "missing_fields": _missing_fields(resume),
    }


def _missing_fields(resume: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not resume.get("skills"):
        missing.append("skills")
    if not resume.get("experience"):
        missing.append("experience")
    if not resume.get("education"):
        missing.append("education")
    return missing


def _format_raw_text(resume: dict[str, Any]) -> str:
    lines: list[str] = []
    skills = resume.get("skills", [])
    if skills:
        lines.append(f"Skills: {', '.join(skills)}")
    for item in resume.get("experience", []):
        lines.append(
            f"Experience: {item.get('title', 'Role')} at {item.get('company', 'Company')} "
            f"({item.get('years', 0)} years) — {item.get('summary', '')}"
        )
    for item in resume.get("education", []):
        lines.append(f"Education: {item.get('degree', 'Degree')}, {item.get('school', 'School')}")
    return "\n".join(lines) if lines else "No extracted text available."
