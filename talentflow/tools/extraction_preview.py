"""Extraction preview: per-section confidence check that runs before scoring.

Mirrors web/src/utils/extractionPreview.ts so the CLI agent loop and the web
UI apply the same rule: header/skills/experience/projects/education each get
a confidence score, and anything missing or malformed is flagged before
evaluate_fit ever sees the resume.
"""

from __future__ import annotations

import re
from typing import Any

_REQUIRED_SECTIONS = ("skills", "experience", "education")

_LABELS = {
    "header": "Header",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
    "education": "Education",
}

_SECTION_LOOKS_LIKE_BODY = re.compile(r"^(skills?|experience|education|projects?)\s*:", re.I)
_PROJECTS_HEADING = re.compile(r"\bprojects?\b\s*:?", re.I)


def _clamp01(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 2)


def _header_preview(raw_text: str) -> dict[str, Any]:
    first_line = next((line.strip() for line in raw_text.splitlines() if line.strip()), "")
    detected = bool(first_line) and not _SECTION_LOOKS_LIKE_BODY.match(first_line)
    confidence = _clamp01(0.85 if detected and len(first_line) > 15 else 0.5) if detected else 0.0

    return {
        "key": "header",
        "label": _LABELS["header"],
        "detected": detected,
        "confidence": confidence,
        "required": False,
        "summary": first_line[:120] if detected else "No header/contact line detected",
    }


def _skills_preview(skills: list[str]) -> dict[str, Any]:
    count = len(skills)
    if count >= 6:
        confidence = 0.92
    elif count >= 3:
        confidence = 0.75
    elif count >= 1:
        confidence = 0.5
    else:
        confidence = 0.0

    detected = count > 0
    warning = None
    if not detected:
        warning = f"{_LABELS['skills']} section not detected."
    elif confidence < 0.6:
        warning = f"{_LABELS['skills']} section low confidence."

    return {
        "key": "skills",
        "label": _LABELS["skills"],
        "detected": detected,
        "confidence": _clamp01(confidence),
        "required": True,
        "summary": f"{count} skill(s) found" if detected else "No skills detected",
        "warning": warning,
    }


def _experience_preview(experience: list[dict[str, Any]]) -> dict[str, Any]:
    count = len(experience)
    complete = sum(
        1
        for item in experience
        if item.get("title") and item.get("company") and item.get("summary") and item.get("years", 0) > 0
    )

    confidence = 0.0
    if count > 0:
        confidence = 0.5 + 0.15 * min(count, 3)
        if complete < count:
            confidence -= 0.12

    detected = count > 0
    warning = None
    if not detected:
        warning = f"{_LABELS['experience']} section not detected."
    elif confidence < 0.6:
        warning = f"{_LABELS['experience']} section low confidence."

    return {
        "key": "experience",
        "label": _LABELS["experience"],
        "detected": detected,
        "confidence": _clamp01(confidence),
        "required": True,
        "summary": f"{count} entry(ies) found" if detected else "No experience detected",
        "warning": warning,
    }


def _education_preview(education: list[dict[str, Any]]) -> dict[str, Any]:
    count = len(education)
    complete = sum(1 for item in education if item.get("degree") and item.get("school"))

    detected = count > 0
    confidence = 0.0
    if detected:
        confidence = 0.85 if complete == count else 0.55

    warning = None
    if not detected:
        warning = f"{_LABELS['education']} section not detected."
    elif confidence < 0.6:
        warning = f"{_LABELS['education']} section low confidence."

    return {
        "key": "education",
        "label": _LABELS["education"],
        "detected": detected,
        "confidence": _clamp01(confidence),
        "required": True,
        "summary": f"{count} entry(ies) found" if detected else "No education detected",
        "warning": warning,
    }


def _projects_preview(raw_text: str) -> dict[str, Any]:
    match = _PROJECTS_HEADING.search(raw_text)
    detected = bool(match)
    content_len = len(raw_text[match.end():]) if match else 0
    confidence = _clamp01(0.78 if content_len > 40 else 0.55) if detected else 0.0

    return {
        "key": "projects",
        "label": _LABELS["projects"],
        "detected": detected,
        "confidence": confidence,
        "required": False,
        "summary": "Projects section found" if detected else "No projects section (optional)",
    }


def build_extraction_preview(resume: dict[str, Any]) -> dict[str, Any]:
    """Compute a per-section confidence preview for a resume before scoring.

    Uses the already-structured skills/experience/education lists (reliable)
    plus a light scan of raw_text for header/projects (which have no
    structured field). Only skills/experience/education gate validity —
    header/projects are informational.
    """
    raw_text = resume.get("raw_text") or ""

    sections = [
        _header_preview(raw_text),
        _skills_preview(resume.get("skills", [])),
        _experience_preview(resume.get("experience", [])),
        _education_preview(resume.get("education", [])),
        _projects_preview(raw_text),
    ]

    warnings = [section["warning"] for section in sections if section.get("warning")]

    required_detected = sum(
        1 for section in sections if section["key"] in _REQUIRED_SECTIONS and section["detected"]
    )
    if required_detected == 0:
        warnings.append("Resume format unclear.")

    is_valid = all(
        next(s for s in sections if s["key"] == key)["detected"] for key in _REQUIRED_SECTIONS
    )

    return {"sections": sections, "warnings": warnings, "is_valid": is_valid}


def format_extraction_preview(candidate_name: str, preview: dict[str, Any]) -> list[str]:
    """Render the preview as CLI-friendly lines, one block per section."""
    status = "validated" if preview["is_valid"] else "needs review"
    lines = [f"{candidate_name} — extraction preview ({status})"]

    for section in preview["sections"]:
        pct = round(section["confidence"] * 100)
        tag = "" if section["required"] else " (optional)"
        lines.append(f"  - {section['label']}{tag}: {pct}% — {section['summary']}")

    for warning in preview["warnings"]:
        lines.append(f"  ⚠ {warning}")

    return lines
