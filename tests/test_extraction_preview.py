"""extraction_preview: per-section confidence check that runs before scoring."""

from talentflow.tools.extraction_preview import build_extraction_preview, format_extraction_preview


def _section(preview, key):
    return next(s for s in preview["sections"] if s["key"] == key)


def test_complete_resume_is_valid_with_no_warnings():
    resume = {
        "skills": ["Python", "Django", "PostgreSQL", "REST APIs", "AWS"],
        "experience": [
            {
                "title": "Senior Backend Engineer",
                "company": "TechCorp",
                "years": 6,
                "summary": "Built REST APIs and data pipelines with Python and PostgreSQL.",
            }
        ],
        "education": [{"degree": "B.S. Computer Science", "school": "State University"}],
        "raw_text": "Jane Doe\nSkills: Python, Django, PostgreSQL\nExperience: ...\nProjects: Built a thing.",
    }

    preview = build_extraction_preview(resume)

    assert preview["is_valid"] is True
    assert preview["warnings"] == []
    assert _section(preview, "skills")["confidence"] > 0.6
    assert _section(preview, "header")["detected"] is True


def test_missing_skills_flags_not_detected():
    resume = {
        "skills": [],
        "experience": [
            {"title": "Engineer", "company": "Acme", "years": 2, "summary": "Did engineering things."}
        ],
        "education": [{"degree": "B.A.", "school": "Some School"}],
        "raw_text": "Some Candidate\nExperience: Engineer at Acme.\nEducation: B.A.",
    }

    preview = build_extraction_preview(resume)

    assert "Skills section not detected." in preview["warnings"]
    assert preview["is_valid"] is False


def test_sparse_experience_flags_low_confidence():
    resume = {
        "skills": ["Python", "SQL", "Excel"],
        "experience": [{"title": "Analyst", "company": "", "years": 0, "summary": ""}],
        "education": [{"degree": "B.A.", "school": "Some School"}],
        "raw_text": "Candidate\nSkills: Python, SQL, Excel\nExperience: Analyst",
    }

    preview = build_extraction_preview(resume)

    assert _section(preview, "experience")["confidence"] < 0.6
    assert "Experience section low confidence." in preview["warnings"]


def test_empty_resume_flags_format_unclear():
    resume = {"skills": [], "experience": [], "education": [], "raw_text": ""}

    preview = build_extraction_preview(resume)

    assert preview["is_valid"] is False
    assert "Resume format unclear." in preview["warnings"]


def test_format_extraction_preview_renders_readable_lines():
    resume = {
        "skills": ["Python"],
        "experience": [],
        "education": [],
        "raw_text": "Someone\nSkills: Python",
    }
    preview = build_extraction_preview(resume)

    lines = format_extraction_preview("Someone", preview)

    assert lines[0].startswith("Someone — extraction preview")
    assert any("Skills" in line for line in lines)
    assert any("⚠" in line for line in lines)
