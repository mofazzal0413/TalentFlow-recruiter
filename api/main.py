"""FastAPI backend for the TalentFlow app."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from talentflow.services.orchestrator import (
    draft_scheduling,
    extract_resume,
    fetch_candidates,
    fetch_feedback,
    fetch_job_requirements,
    get_job,
    import_ats_export,
    list_jobs,
    run_evaluation,
    save_feedback_correction,
)

app = FastAPI(title="TalentFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EvaluateRequest(BaseModel):
    candidates: list[dict[str, Any]]
    resumes: dict[str, dict[str, Any]]
    force_refresh: bool = False


class SchedulingRequest(BaseModel):
    strong_candidates: list[dict[str, Any]]
    checkpoint_approved: bool = False


class FeedbackRequest(BaseModel):
    candidate_id: str
    candidate_name: str
    comment: str
    corrected_match_score: int | None = None
    corrected_meets_bar: bool | None = None
    scorecard: dict[str, int] | None = None


class JobResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    level: str
    description: str
    status: str = "open"
    candidate_count: int = 0


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/jobs", response_model=list[JobResponse])
def get_jobs() -> list[dict[str, Any]]:
    return list_jobs()


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
def get_job_by_id(job_id: str) -> dict[str, Any]:
    try:
        return get_job(job_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/jobs/{job_id}/candidates")
def post_candidates(job_id: str) -> dict[str, Any]:
    try:
        return fetch_candidates(job_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/candidates/{candidate_id}/resume")
def post_resume(candidate_id: str) -> dict[str, Any]:
    try:
        return extract_resume(candidate_id)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/api/jobs/{job_id}/requirements")
def get_requirements(job_id: str) -> dict[str, Any]:
    try:
        return fetch_job_requirements(job_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/jobs/{job_id}/requirements/ats-import")
async def post_ats_import(job_id: str, file: UploadFile = File(...)) -> dict[str, Any]:
    try:
        content = await file.read()
        if not content:
            raise ValueError("Uploaded file is empty.")
        return import_ats_export(job_id, content, file.filename or "export.json")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/jobs/{job_id}/evaluate")
def post_evaluate(job_id: str, payload: EvaluateRequest) -> dict[str, Any]:
    try:
        return run_evaluation(payload.candidates, payload.resumes, job_id, force_refresh=payload.force_refresh)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/jobs/{job_id}/scheduling")
def post_scheduling(job_id: str, payload: SchedulingRequest) -> dict[str, Any]:
    if not payload.checkpoint_approved:
        raise HTTPException(
            status_code=403,
            detail="Checkpoint approval required before scheduling.",
        )
    try:
        return draft_scheduling(job_id, payload.strong_candidates)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/api/jobs/{job_id}/feedback")
def get_job_feedback(job_id: str, candidate_id: str | None = None) -> dict[str, Any]:
    try:
        return fetch_feedback(job_id, candidate_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/jobs/{job_id}/feedback")
def post_job_feedback(job_id: str, payload: FeedbackRequest) -> dict[str, Any]:
    try:
        entry = save_feedback_correction(
            job_id=job_id,
            candidate_id=payload.candidate_id,
            candidate_name=payload.candidate_name,
            comment=payload.comment,
            corrected_match_score=payload.corrected_match_score,
            corrected_meets_bar=payload.corrected_meets_bar,
            scorecard=payload.scorecard,
        )
        return {"feedback": entry}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
