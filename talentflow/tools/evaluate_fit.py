"""Compute match score and ranking for candidates."""

from __future__ import annotations

import re
from typing import Any

from talentflow.tools.experience_utils import compute_experience_years

_KEYWORD_MAP: dict[str, list[str]] = {
    "python": ["python"],
    "postgresql": ["postgresql", "postgres"],
    "rest apis": ["rest", "rest api", "rest apis", "api", "apis"],
    "aws": ["aws", "amazon web services"],
    "django": ["django"],
    "react": ["react"],
    "typescript": ["typescript", "ts"],
    "sql": ["sql"],
    "machine learning": ["machine learning", "ml", "pytorch", "scikit-learn"],
    "genai": ["genai", "llm", "langchain", "rag"],
    "distributed systems": ["distributed", "microservices", "kafka"],
    "kubernetes": ["kubernetes", "k8s"],
    "terraform": ["terraform"],
    "figma": ["figma"],
}


def _normalize(value: str) -> str:
    return value.strip().lower()


def _skill_corpus(skills: list[str], experience: list[dict[str, Any]], raw_text: str = "") -> str:
    parts = [skill for skill in skills]
    for item in experience:
        parts.extend([item.get("title", ""), item.get("summary", ""), item.get("company", "")])
    if raw_text:
        parts.append(raw_text)
    return _normalize(" ".join(parts))


def _contains_keyword(text: str, keyword: str) -> bool:
    """Whole-word/phrase match.

    Plain substring checks let generic terms like "sql" match inside unrelated
    words (e.g. "sql" is a substring of both "postgresql" and "mysql"), which
    previously caused the matcher to credit a candidate with PostgreSQL when
    their resume only listed MySQL. Word-boundary matching prevents that.
    """
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return bool(re.search(pattern, text))


def _has_skill(skills: list[str], experience: list[dict[str, Any]], requirement: str, raw_text: str = "") -> bool:
    requirement_value = _normalize(requirement)
    corpus = _skill_corpus(skills, experience, raw_text)
    normalized_skills = {_normalize(skill) for skill in skills}

    if requirement_value in normalized_skills:
        return True

    for skill_key, keywords in _KEYWORD_MAP.items():
        key_matches_requirement = _contains_keyword(requirement_value, skill_key) or any(
            _contains_keyword(requirement_value, keyword) for keyword in keywords
        )
        if key_matches_requirement:
            if skill_key in normalized_skills or any(
                _contains_keyword(corpus, keyword) for keyword in keywords
            ):
                return True

    keywords = _KEYWORD_MAP.get(requirement_value, [requirement_value])
    return any(_contains_keyword(corpus, keyword) for keyword in keywords)


def _parse_years_requirement(requirement: str) -> int | None:
    match = re.search(r"(\d+)\+?\s*years?\s+experience", requirement, re.I)
    if match:
        return int(match.group(1))
    return None


def _check_requirement(
    requirement: str,
    skills: list[str],
    experience: list[dict[str, Any]],
    raw_text: str = "",
) -> bool:
    years_required = _parse_years_requirement(requirement)
    if years_required is not None:
        total_years, _ = compute_experience_years(experience)
        return total_years >= years_required

    return _has_skill(skills, experience, requirement, raw_text)


def _conflicts_with_tags(
    tags: list[str],
    skills: list[str],
    experience: list[dict[str, Any]],
) -> list[str]:
    issues: list[str] = []
    normalized_tags = {_normalize(tag) for tag in tags}
    normalized_skills = {_normalize(skill) for skill in skills}
    total_years, _ = compute_experience_years(experience)

    if "senior" in normalized_tags and total_years < 5:
        issues.append("ATS tags indicate senior level but resume shows limited experience")

    if "python" in normalized_tags and "python" not in normalized_skills:
        issues.append("ATS tags include Python but resume skills do not list Python")

    if "lead" in normalized_tags and not experience:
        issues.append("ATS tags indicate lead experience but resume has no work history")

    return issues


def evaluate_fit(
    candidates: list[dict[str, Any]],
    resumes: dict[str, dict[str, Any]],
    job_requirements: dict[str, Any],
) -> list[dict[str, Any]]:
    """Score and rank candidates against job requirements."""
    must_have = job_requirements.get("must_have", [])
    nice_to_have = job_requirements.get("nice_to_have", [])
    results: list[dict[str, Any]] = []

    for candidate in candidates:
        candidate_id = candidate["id"]
        resume = resumes.get(candidate_id, {})
        skills = resume.get("skills", [])
        experience = resume.get("experience", [])
        education = resume.get("education", [])
        raw_text = resume.get("raw_text", "")

        must_matches = [
            _check_requirement(req, skills, experience, raw_text) for req in must_have
        ]
        nice_matches = [
            _check_requirement(req, skills, experience, raw_text) for req in nice_to_have
        ]

        must_score = (sum(must_matches) / len(must_have) * 70) if must_have else 0
        nice_score = (sum(nice_matches) / len(nice_to_have) * 30) if nice_to_have else 0
        match_score = round(must_score + nice_score)

        missing_must = [
            requirement
            for requirement, matched in zip(must_have, must_matches, strict=True)
            if not matched
        ]
        missing_nice = [
            requirement
            for requirement, matched in zip(nice_to_have, nice_matches, strict=True)
            if not matched
        ]
        matched_nice = [
            requirement
            for requirement, matched in zip(nice_to_have, nice_matches, strict=True)
            if matched
        ]

        mismatch_flags = [f"Missing must-have: {item}" for item in missing_must]
        if missing_nice:
            mismatch_flags.extend([f"Missing nice-to-have: {item}" for item in missing_nice[:2]])

        uncertainty_flags: list[str] = []
        if not skills and not experience and not education:
            uncertainty_flags.append("Resume is sparse — limited skills, experience, and education data")
        if resume.get("suspicious_content"):
            uncertainty_flags.append("Suspicious content detected in resume text")

        _, experience_flags = compute_experience_years(experience)
        uncertainty_flags.extend(experience_flags)
        uncertainty_flags.extend(_conflicts_with_tags(candidate.get("tags", []), skills, experience))

        if match_score < 70 and not missing_must:
            uncertainty_flags.append("Score below bar despite matching must-haves — review weighting")

        if missing_must:
            reason = f"Missing must-haves: {', '.join(missing_must)}."
        else:
            extras = f" Nice-to-haves: {', '.join(matched_nice)}." if matched_nice else ""
            reason = f"Meets all must-have requirements.{extras}"

        results.append(
            {
                "candidate_id": candidate_id,
                "name": candidate["name"],
                "match_score": match_score,
                "meets_bar": len(missing_must) == 0 and match_score >= 70,
                "reason": reason.strip(),
                "uncertainty_flags": uncertainty_flags,
                "mismatch_flags": mismatch_flags,
                "missing_must_have": missing_must,
            }
        )

    results.sort(key=lambda item: item["match_score"], reverse=True)
    for index, result in enumerate(results, start=1):
        result["rank"] = index

    return results
