"""Locks in the evaluate_fit_talentflow_agent swap in orchestrator.py.

orchestrator.evaluate_fit is an import alias, not a call site — nothing else
in this test suite would fail if a future refactor quietly pointed it back at
the keyword matcher (talentflow.tools.evaluate_fit.evaluate_fit) instead of
the voting LLM screener, since both implementations satisfy the same
candidates/resumes/job_requirements -> list[dict] contract. This test exists
purely to make that regression fail loudly.
"""

from talentflow.services import orchestrator
from talentflow.tools.evaluate_fit import evaluate_fit as keyword_evaluate_fit
from talentflow.tools.evaluate_fit_talentflow_agent import evaluate_fit_llm


def test_orchestrator_evaluate_fit_is_the_talentflow_agent_screener():
    assert orchestrator.evaluate_fit is evaluate_fit_llm


def test_orchestrator_evaluate_fit_is_not_the_keyword_matcher():
    assert orchestrator.evaluate_fit is not keyword_evaluate_fit
