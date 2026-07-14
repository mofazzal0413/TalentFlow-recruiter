from talentflow.tools.experience_utils import compute_experience_years
from talentflow.tools.ingest_job_description import ingest_job_description
from talentflow.tools.evaluate_fit import evaluate_fit
from talentflow.tools.get_job_requirements import get_job_requirements


def test_ingest_job_description_extracts_python_and_years():
    description = (
        "We need a Senior Backend Engineer.\n\n"
        "Key responsibilities:\n"
        "- Build RESTful services in Python\n"
        "- Optimize PostgreSQL queries\n\n"
        "Experience with AWS is a plus."
    )
    result = ingest_job_description(description, title="Senior Backend Engineer", level="Senior")
    assert "Python" in result["must_have"]
    assert "5+ years experience" in result["must_have"]
    assert "AWS" in result["nice_to_have"]


def test_get_job_requirements_uses_job_id_from_jobs_json():
    reqs = get_job_requirements("job_001")
    assert reqs["job_id"] == "job_001"
    assert "Python" in reqs["must_have"]
    assert reqs["has_override"] is True
    assert reqs["ingestion_source"] == "recruiter_override"


def test_compute_experience_years_flags_overlap():
    experience = [
        {"title": "A", "company": "X", "years": 6, "summary": ""},
        {"title": "B", "company": "Y", "years": 7, "summary": ""},
        {"title": "C", "company": "Z", "years": 8, "summary": ""},
    ]
    total, flags = compute_experience_years(experience)
    assert total == 21
    assert any("overlap" in flag.lower() for flag in flags)


def test_evaluate_fit_emits_mismatch_flags():
    candidates = [{"id": "c1", "name": "Test", "tags": []}]
    resumes = {
        "c1": {
            "skills": ["Java"],
            "experience": [{"title": "Dev", "company": "Co", "years": 1, "summary": ""}],
            "education": [],
        }
    }
    requirements = {
        "must_have": ["Python", "5+ years experience"],
        "nice_to_have": ["AWS"],
    }
    ranked = evaluate_fit(candidates, resumes, requirements)
    assert ranked[0]["mismatch_flags"]
    assert any("Missing must-have" in flag for flag in ranked[0]["mismatch_flags"])
    assert ranked[0]["meets_bar"] is False


def test_evaluate_fit_precise_experience_counting():
    candidates = [{"id": "c1", "name": "Senior Dev", "tags": []}]
    resumes = {
        "c1": {
            "skills": ["Python", "PostgreSQL", "REST APIs"],
            "experience": [
                {"title": "Eng", "company": "A", "years": 3, "summary": ""},
                {"title": "Eng", "company": "B", "years": 3, "summary": ""},
            ],
            "education": [{"degree": "BS", "school": "U"}],
        }
    }
    requirements = {"must_have": ["Python", "5+ years experience", "PostgreSQL", "REST APIs"], "nice_to_have": []}
    ranked = evaluate_fit(candidates, resumes, requirements)
    assert ranked[0]["meets_bar"] is True
