"""TalentFlow agent orchestrator."""

from __future__ import annotations

from typing import Any

from talentflow.tools import (
    evaluate_fit,
    get_calendar_slots,
    get_candidates,
    get_job_requirements,
    get_resume_text,
)

CLARIFICATION_MAP = {
    "sparse": "Confirm skills, experience, and education with the candidate or hiring manager",
    "senior": "Confirm seniority level and total years of experience",
    "python": "Confirm Python proficiency against role requirements",
    "lead": "Confirm lead or management experience",
    "suspicious": "Review raw resume text manually before trusting extracted fields",
}


def _clarification_for(issue: str) -> str:
    issue_lower = issue.lower()
    if "sparse" in issue_lower:
        return CLARIFICATION_MAP["sparse"]
    if "senior" in issue_lower:
        return CLARIFICATION_MAP["senior"]
    if "python" in issue_lower:
        return CLARIFICATION_MAP["python"]
    if "lead" in issue_lower:
        return CLARIFICATION_MAP["lead"]
    if "suspicious" in issue_lower:
        return CLARIFICATION_MAP["suspicious"]
    return "Confirm missing or conflicting candidate details before advancing"


def _format_ranked_shortlist(ranked: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for result in ranked:
        lines.append(
            f"[{result['rank']}] {result['name']} — Match Score: {result['match_score']}% — Reason: {result['reason']}"
        )
    return lines


def _format_scheduling_options(
    strong_candidates: list[dict[str, Any]],
    proposed_slots: list[str],
) -> list[str]:
    if not strong_candidates:
        return []

    slot_text = ", ".join(f"[{slot}]" for slot in proposed_slots)
    return [f"{candidate['name']} — Proposed Slots: {slot_text}" for candidate in strong_candidates]


def _format_uncertainty_flags(ranked: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for result in ranked:
        for issue in result.get("uncertainty_flags", []):
            lines.append(
                "Issue: "
                f"{issue} — Candidate: {result['name']} — "
                f"Clarification Needed: {_clarification_for(issue)}"
            )
    return lines


def run() -> str:
    """Execute the PRD tool sequence and return structured output."""
    candidates = get_candidates("job_001")

    resumes: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        resumes[candidate["id"]] = get_resume_text(candidate["id"])

    job_requirements = get_job_requirements("job_001")
    ranked = evaluate_fit(candidates, resumes, job_requirements)

    strong_candidates = [result for result in ranked if result["meets_bar"]]
    calendar = get_calendar_slots([result["candidate_id"] for result in strong_candidates])

    sections = [
        "A. Ranked Shortlist",
        *_format_ranked_shortlist(ranked),
        "",
        "B. Scheduling Options (Strong candidates only)",
    ]

    scheduling_lines = _format_scheduling_options(
        strong_candidates,
        calendar.get("proposed_slots", []),
    )
    if scheduling_lines:
        sections.extend(scheduling_lines)
    else:
        sections.append("None")

    sections.extend(
        [
            "",
            "C. Uncertainty Flags",
        ]
    )

    uncertainty_lines = _format_uncertainty_flags(ranked)
    if uncertainty_lines:
        sections.extend(uncertainty_lines)
    else:
        sections.append("None")

    return "\n".join(sections)
