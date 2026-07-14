import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from talentflow.tools._data import DATA_DIR
from talentflow.tools.get_job_requirements import get_job_requirements
from talentflow.tools.ingest_ats_export import build_requirements_override, parse_ats_export


def test_parse_ats_export_json():
    content = json.dumps(
        {
            "job_id": "job_005",
            "title": "DevOps Engineer",
            "description": "AWS and Kubernetes required.",
            "must_have": ["AWS", "Kubernetes"],
            "nice_to_have": ["Terraform"],
        }
    )
    parsed = parse_ats_export(content, "export.json")
    assert parsed["job_id"] == "job_005"
    assert "AWS" in parsed["must_have"]


def test_parse_ats_export_csv():
    content = (
        "job_id,title,description,must_have,nice_to_have\n"
        "job_006,UX Designer,Design workflows,Figma|Wireframes,Prototyping\n"
    )
    parsed = parse_ats_export(content, "export.csv")
    assert parsed["job_id"] == "job_006"
    assert parsed["must_have"] == ["Figma", "Wireframes"]
    assert parsed["nice_to_have"] == ["Prototyping"]


def test_build_requirements_override_from_description():
    parsed = {
        "title": "Data Analyst",
        "level": "Junior",
        "description": "Looking for SQL proficiency and clear written communication.",
        "must_have": [],
        "nice_to_have": [],
    }
    override = build_requirements_override(parsed)
    assert "SQL" in override["must_have"]
    assert override["source"] == "ats_export"


def test_get_job_requirements_reads_per_job_override():
    reqs = get_job_requirements("job_001")
    assert reqs["has_override"] is True
    assert reqs["ingestion_source"] == "recruiter_override"
    assert "Mentoring experience" in reqs["nice_to_have"]


def test_get_job_requirements_without_override():
    reqs = get_job_requirements("job_003")
    assert reqs["has_override"] is False
    assert "React" in reqs["must_have"] or "TypeScript" in reqs["must_have"]


@pytest.fixture
def api_client():
    from api.main import app

    return TestClient(app)


def test_ats_import_endpoint_updates_job_requirements(api_client, tmp_path, monkeypatch):
    sample_path = DATA_DIR / "ats_exports" / "sample_devops_export.json"
    original_overrides_path = DATA_DIR / "job_requirements_by_job.json"
    backup_overrides = original_overrides_path.read_text(encoding="utf-8")

    try:
        response = api_client.post(
            "/api/jobs/job_005/requirements/ats-import",
            files={"file": ("sample_devops_export.json", sample_path.read_bytes(), "application/json")},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["has_override"] is True
        assert payload["ingestion_source"] == "ats_export"
        assert "Kubernetes" in payload["must_have"]
        assert payload["import_summary"]["filename"] == "sample_devops_export.json"
    finally:
        original_overrides_path.write_text(backup_overrides, encoding="utf-8")
