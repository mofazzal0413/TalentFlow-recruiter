"""Derive screening criteria from job description text (API / DB / ATS source)."""

from __future__ import annotations

import re
from typing import Any

_SKILL_MUST_PATTERNS = [
    (re.compile(r"\bpython\b", re.I), "Python"),
    (re.compile(r"\bpostgresql\b|\bpostgres\b", re.I), "PostgreSQL"),
    (re.compile(r"\brest\s*api", re.I), "REST APIs"),
    (re.compile(r"\breact\b", re.I), "React"),
    (re.compile(r"\btypescript\b", re.I), "TypeScript"),
    (re.compile(r"\bsql\b", re.I), "SQL"),
    (re.compile(r"\bpytorch\b|\bscikit-learn\b", re.I), "Machine Learning"),
    (re.compile(r"\bllm\b|\bgenai\b|\brag\b", re.I), "GenAI"),
]

_SKILL_NICE_PATTERNS = [
    (re.compile(r"\baws\b", re.I), "AWS"),
    (re.compile(r"\bdjango\b", re.I), "Django"),
    (re.compile(r"\bkubernetes\b", re.I), "Kubernetes"),
    (re.compile(r"\bdistributed\b", re.I), "distributed systems"),
    (re.compile(r"\bfigma\b", re.I), "Figma"),
    (re.compile(r"\bterraform\b", re.I), "Terraform"),
]


def _years_requirement(level: str) -> str | None:
    normalized = level.strip().lower()
    if normalized in {"senior", "staff", "principal"}:
        return "5+ years experience"
    if normalized in {"mid-level", "mid level", "mid"}:
        return "3+ years experience"
    if normalized in {"junior", "entry"}:
        return "1+ years experience"
    return None


def ingest_job_description(
    description: str,
    title: str = "",
    level: str = "",
) -> dict[str, Any]:
    """Parse job description bullets and text into must-have / nice-to-have criteria."""
    must_have: list[str] = []
    nice_to_have: list[str] = []
    combined = f"{title}\n{description}"

    years = _years_requirement(level)
    if years:
        must_have.append(years)

    for pattern, label in _SKILL_MUST_PATTERNS:
        if pattern.search(combined) and label not in must_have:
            if label in {"Machine Learning", "GenAI"}:
                nice_to_have.append(label)
            else:
                must_have.append(label)

    for pattern, label in _SKILL_NICE_PATTERNS:
        if pattern.search(combined) and label not in must_have and label not in nice_to_have:
            nice_to_have.append(label)

    for block in description.split("\n\n"):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        bullet_lines = [line for line in lines if re.match(r"^[-•*]\s+", line)]
        if not bullet_lines:
            continue
        intro = lines[0] if lines and not re.match(r"^[-•*]\s+", lines[0]) else ""
        is_required = "required" in intro.lower() or "must have" in intro.lower()
        target = must_have if is_required else nice_to_have
        for bullet in bullet_lines:
            text = re.sub(r"^[-•*]\s+", "", bullet).strip()
            if any(pattern.search(text) for pattern, _ in _SKILL_MUST_PATTERNS + _SKILL_NICE_PATTERNS):
                continue
            if len(text) > 12 and text not in target:
                target.append(text[:80])

    must_have = list(dict.fromkeys(must_have))
    nice_to_have = list(dict.fromkeys(item for item in nice_to_have if item not in must_have))

    return {
        "must_have": must_have,
        "nice_to_have": nice_to_have,
        "ingestion_source": "job_description",
    }
