"""Schema validation for agent-produced structured output."""

from __future__ import annotations

import re
from typing import Any

_INJECTION_PATTERNS = (
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.I),
    re.compile(r"schedule\s+me\s+immediately", re.I),
    re.compile(r"you\s+are\s+now\s+in\s+scheduling\s+mode", re.I),
)

_DRAFT_MARKER = re.compile(r"\[DRAFT\s*[—-]\s*NOT SENT\]", re.I)


def _is_string(value: Any) -> bool:
    return isinstance(value, str)


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _has_injection(text: str) -> bool:
    return any(pattern.search(text) for pattern in _INJECTION_PATTERNS)


def _fail(errors: list[str]) -> None:
    if errors:
        raise ValueError("; ".join(errors))


def validate_shortlist(data: Any) -> list[dict[str, Any]]:
    """Validate ranked shortlist items before API/UI consumption."""
    errors: list[str] = []

    if not isinstance(data, list):
        raise ValueError("Shortlist must be an array.")

    validated: list[dict[str, Any]] = []
    for index, entry in enumerate(data):
        prefix = f"Shortlist item {index + 1}"
        item_errors: list[str] = []

        if not isinstance(entry, dict):
            errors.append(f"{prefix}: must be an object.")
            continue

        candidate_id = entry.get("candidate_id")
        name = entry.get("name")
        rank = entry.get("rank")
        match_score = entry.get("match_score")
        meets_bar = entry.get("meets_bar")
        reason = entry.get("reason")
        uncertainty_flags = entry.get("uncertainty_flags", [])
        mismatch_flags = entry.get("mismatch_flags")

        if not _is_string(candidate_id) or not candidate_id.strip():
            item_errors.append(f"{prefix}: candidate_id must be a non-empty string.")
        if not _is_string(name) or not name.strip():
            item_errors.append(f"{prefix}: name must be a non-empty string.")
        if not isinstance(rank, (int, float)) or rank < 1:
            item_errors.append(f"{prefix}: rank must be a positive number.")
        if not isinstance(match_score, (int, float)) or match_score < 0 or match_score > 100:
            item_errors.append(f"{prefix}: match_score must be between 0 and 100.")
        if not isinstance(meets_bar, bool):
            item_errors.append(f"{prefix}: meets_bar must be a boolean.")
        if not _is_string(reason):
            item_errors.append(f"{prefix}: reason must be a string.")
        if not _is_string_list(uncertainty_flags):
            item_errors.append(f"{prefix}: uncertainty_flags must be an array of strings.")
        if mismatch_flags is not None and not _is_string_list(mismatch_flags):
            item_errors.append(f"{prefix}: mismatch_flags must be an array of strings.")
        if _is_string(reason) and _has_injection(reason):
            item_errors.append(f"{prefix}: reason contains suspicious agent instruction text.")

        if item_errors:
            errors.extend(item_errors)
            continue

        validated.append(entry)

    _fail(errors)
    return validated


def validate_resume(data: Any) -> dict[str, Any]:
    """Validate extracted resume payload."""
    errors: list[str] = []

    if not isinstance(data, dict):
        raise ValueError("Resume must be an object.")

    skills = data.get("skills")
    experience = data.get("experience")
    education = data.get("education")

    if not _is_string_list(skills):
        errors.append("skills must be an array of strings.")

    if not isinstance(experience, list):
        errors.append("experience must be an array.")
    else:
        for index, item in enumerate(experience):
            if not isinstance(item, dict):
                errors.append(f"experience[{index}] must be an object.")
                continue
            if not _is_string(item.get("title")):
                errors.append(f"experience[{index}].title must be a string.")
            if not _is_string(item.get("company")):
                errors.append(f"experience[{index}].company must be a string.")
            years = item.get("years")
            if not isinstance(years, (int, float)) or years < 0:
                errors.append(f"experience[{index}].years must be a non-negative number.")
            if not _is_string(item.get("summary")):
                errors.append(f"experience[{index}].summary must be a string.")

    if not isinstance(education, list):
        errors.append("education must be an array.")
    else:
        for index, item in enumerate(education):
            if not isinstance(item, dict):
                errors.append(f"education[{index}] must be an object.")
                continue
            if not _is_string(item.get("degree")):
                errors.append(f"education[{index}].degree must be a string.")
            if not _is_string(item.get("school")):
                errors.append(f"education[{index}].school must be a string.")

    for field in ("raw_text", "source_format", "error"):
        if field in data and not _is_string(data[field]):
            errors.append(f"{field} must be a string when provided.")
    if "missing_fields" in data and not _is_string_list(data["missing_fields"]):
        errors.append("missing_fields must be an array of strings when provided.")
    if "suspicious_content" in data and not isinstance(data["suspicious_content"], bool):
        errors.append("suspicious_content must be a boolean when provided.")

    _fail(errors)
    return data


def validate_calendar_slots(data: Any) -> dict[str, Any]:
    """Validate calendar availability payload."""
    errors: list[str] = []

    if not isinstance(data, dict):
        raise ValueError("Calendar slots must be an object.")

    proposed_slots = data.get("proposed_slots")
    if not _is_string_list(proposed_slots):
        errors.append("proposed_slots must be an array of strings.")
    elif not proposed_slots:
        errors.append("proposed_slots must contain at least one slot.")
    elif any(not slot.strip() for slot in proposed_slots):
        errors.append("proposed_slots cannot include empty values.")

    if "timezone" in data and not _is_string(data["timezone"]):
        errors.append("timezone must be a string when provided.")
    if "panel" in data and not _is_string_list(data["panel"]):
        errors.append("panel must be an array of strings when provided.")

    free_blocks = data.get("free_blocks")
    if free_blocks is not None:
        if not isinstance(free_blocks, list):
            errors.append("free_blocks must be an array when provided.")
        else:
            for index, block in enumerate(free_blocks):
                if not isinstance(block, dict):
                    errors.append(f"free_blocks[{index}] must be an object.")
                    continue
                if not _is_string(block.get("start")) or not _is_string(block.get("end")):
                    errors.append(f"free_blocks[{index}] must include start and end strings.")

    _fail(errors)
    return data


def validate_draft_email(data: Any) -> str:
    """Validate draft outreach email text."""
    errors: list[str] = []

    if not _is_string(data):
        raise ValueError("Draft email must be a string.")

    text = data.strip()
    if not text:
        errors.append("Draft email cannot be empty.")
    if len(text) > 8000:
        errors.append("Draft email exceeds maximum allowed length.")
    if "To:" not in text:
        errors.append('Draft email must include a "To:" line.')
    if not _DRAFT_MARKER.search(text):
        errors.append("Draft email must include the [DRAFT — NOT SENT] safety marker.")
    if _has_injection(text):
        errors.append("Draft email contains suspicious agent instruction text.")

    _fail(errors)
    return data
