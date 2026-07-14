from talentflow.services.orchestrator import draft_scheduling, run_evaluation
from talentflow.tools.get_resume_text import get_resume_text
from talentflow.tools.parse_resume_file import extract_text_from_file
from talentflow.tools._data import DATA_DIR


def test_resume_txt_extraction_from_file():
    path = DATA_DIR / "resumes" / "jane_doe.txt"
    text = extract_text_from_file(path)
    assert "Python" in text
    assert "TechCorp" in text


def test_get_resume_text_loads_txt_when_pdf_missing():
    resume = get_resume_text("cand_001")
    assert "Python" in resume["raw_text"]
    assert resume["source_format"] == "txt"


def test_get_resume_text_detects_injection_from_file():
    resume = get_resume_text("cand_004")
    assert resume.get("suspicious_content") is True
    assert "IGNORE ALL PREVIOUS" in resume["raw_text"]


def test_scheduling_drafts_are_draft_only():
    candidates = [{"id": "cand_001", "name": "Jane Doe", "tags": []}]
    resumes = {"cand_001": get_resume_text("cand_001")}
    evaluation = run_evaluation(candidates, resumes, "job_001")
    strong = evaluation["strong_candidates"]
    if not strong:
        strong = evaluation["shortlist"][:1]
    result = draft_scheduling("job_001", strong)
    for draft in result["drafts"]:
        assert "[DRAFT — NOT SENT]" in draft["draft_email"]
        assert "To:" in draft["draft_email"]
        assert "send" not in draft["draft_email"].lower().split("[draft")[0]
