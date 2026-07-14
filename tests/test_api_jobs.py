from talentflow.services.orchestrator import get_job, list_jobs

REQUIRED_FIELDS = {"id", "title", "department", "location", "level", "description"}


def test_list_jobs_returns_required_fields():
    jobs = list_jobs()
    assert len(jobs) > 0

    for job in jobs:
        assert REQUIRED_FIELDS.issubset(job.keys())
        assert isinstance(job["id"], str)
        assert isinstance(job["description"], str)


def test_list_jobs_candidate_count_matches_data():
    jobs = list_jobs()
    by_id = {job["id"]: job for job in jobs}
    assert by_id["job_001"]["candidate_count"] == 4
    assert by_id["job_002"]["candidate_count"] == 2
    assert by_id["job_004"]["candidate_count"] == 1
    assert by_id["job_005"]["candidate_count"] == 1


def test_get_job_returns_single_record_by_id():
    job = get_job("job_001")
    assert job["id"] == "job_001"
    assert job["title"] == "Senior Backend Engineer"
    assert "description" in job
