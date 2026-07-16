"""Run keyword-matching evaluate_fit vs Claude Sonnet 4.6 evaluate_fit on the same input.

Usage:
    python -m talentflow.tools.compare_evaluate_fit

Requires ANTHROPIC_API_KEY in .env (see .env.example).
"""

from __future__ import annotations

from talentflow.tools import evaluate_fit, get_candidates, get_job_requirements, get_resume_text
from talentflow.tools.evaluate_fit_llm import evaluate_fit_llm


def _print_results(label: str, results: list[dict]) -> None:
    print(f"\n{'=' * 60}")
    print(label)
    print("=" * 60)
    for result in results:
        print(f"[{result['rank']}] {result['name']} — {result['match_score']}% — meets_bar={result['meets_bar']}")
        print(f"    Reason: {result['reason']}")
        if result.get("uncertainty_flags"):
            print(f"    Uncertainty: {result['uncertainty_flags']}")
        if result.get("mismatch_flags"):
            print(f"    Mismatch: {result['mismatch_flags']}")
        print()


def main() -> None:
    job_id = "job_001"
    candidates = get_candidates(job_id)
    resumes = {c["id"]: get_resume_text(c["id"]) for c in candidates}
    job_requirements = get_job_requirements(job_id)

    keyword_results = evaluate_fit(candidates, resumes, job_requirements)
    _print_results("KEYWORD-MATCHING evaluate_fit (existing)", keyword_results)

    llm_results = evaluate_fit_llm(candidates, resumes, job_requirements)
    _print_results("CLAUDE SONNET 4.6 evaluate_fit_llm (new)", llm_results)


if __name__ == "__main__":
    main()
