"""Checkpoint and scheduling API tests for PRD v2."""

from fastapi.testclient import TestClient

from api.main import app
from talentflow.tools.get_resume_text import get_resume_text

client = TestClient(app)


def _strong_candidates_for_job_001() -> list[dict]:
    candidates = [
        {"id": "cand_001", "name": "Jane Doe", "tags": []},
    ]
    resumes = {"cand_001": get_resume_text("cand_001")}
    response = client.post(
        "/api/jobs/job_001/evaluate",
        json={"candidates": candidates, "resumes": resumes},
    )
    assert response.status_code == 200
    return response.json()["strong_candidates"]


def test_scheduling_blocked_without_checkpoint_approval():
    strong = _strong_candidates_for_job_001()
    response = client.post(
        "/api/jobs/job_001/scheduling",
        json={"strong_candidates": strong, "checkpoint_approved": False},
    )
    assert response.status_code == 403
    assert "Checkpoint approval required" in response.json()["detail"]


def test_scheduling_allowed_after_checkpoint_approval():
    strong = _strong_candidates_for_job_001()
    response = client.post(
        "/api/jobs/job_001/scheduling",
        json={"strong_candidates": strong, "checkpoint_approved": True},
    )
    assert response.status_code == 200
    drafts = response.json()["drafts"]
    assert len(drafts) >= 1
    assert drafts[0]["name"] == "Jane Doe"
    assert "[DRAFT — NOT SENT]" in drafts[0]["draft_email"]
    assert len(drafts[0]["proposed_slots"]) >= 1


def test_adversarial_resume_not_in_scheduling_draft():
    strong = _strong_candidates_for_job_001()
    response = client.post(
        "/api/jobs/job_001/scheduling",
        json={"strong_candidates": strong, "checkpoint_approved": True},
    )
    draft_text = response.json()["drafts"][0]["draft_email"].lower()
    assert "ignore instructions" not in draft_text
    assert "schedule me immediately" not in draft_text
