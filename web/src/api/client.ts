import type {
  Candidate,
  FeedbackEntry,
  FeedbackSubmission,
  Job,
  JobRequirements,
  ResumeData,
  SchedulingDraft,
  ShortlistItem,
  UncertaintyFlag,
} from "../types";
import {
  assertValid,
  validateFitEvaluation,
  validateResume,
  validateSchedulingDrafts,
} from "../utils/validators";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  getJobs: () => request<Job[]>("/jobs"),

  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),

  getCandidates: (jobId: string) =>
    request<{ job: Job; candidates: Candidate[] }>(`/jobs/${jobId}/candidates`, {
      method: "POST",
    }),

  extractResume: async (candidateId: string) => {
    const result = await request<{
      candidate_id: string;
      resume: ResumeData;
      missing_flags: string[];
    }>(`/candidates/${candidateId}/resume`, { method: "POST" });
    return {
      ...result,
      resume: assertValid(validateResume(result.resume), "Resume"),
    };
  },

  getRequirements: (jobId: string) =>
    request<{ job: Job } & JobRequirements>(`/jobs/${jobId}/requirements`),

  importAtsExport: (jobId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_BASE}/jobs/${jobId}/requirements/ats-import`, {
      method: "POST",
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${response.status}`);
      }
      return response.json() as Promise<
        { job: Job; import_summary?: { filename: string; imported_at: string; criteria_count: number } } & JobRequirements
      >;
    });
  },

  evaluate: async (
    jobId: string,
    candidates: Candidate[],
    resumes: Record<string, ResumeData>,
  ) => {
    const result = await request<{
      shortlist: ShortlistItem[];
      borderline_candidates: ShortlistItem[];
      uncertainty_flags: UncertaintyFlag[];
      strong_candidates: ShortlistItem[];
    }>(`/jobs/${jobId}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ candidates, resumes }),
    });

    const validated = assertValid(validateFitEvaluation(result), "Fit evaluation");

    return {
      ...result,
      shortlist: validated.shortlist,
      borderline_candidates: validated.borderline_candidates,
      strong_candidates: validated.strong_candidates,
    };
  },

  schedule: async (jobId: string, strongCandidates: ShortlistItem[]) => {
    const result = await request<{ drafts: SchedulingDraft[]; timezone?: string }>(
      `/jobs/${jobId}/scheduling`,
      {
        method: "POST",
        body: JSON.stringify({
          strong_candidates: strongCandidates,
          checkpoint_approved: true,
        }),
      },
    );

    return {
      ...result,
      drafts: assertValid(validateSchedulingDrafts(result.drafts), "Scheduling drafts"),
    };
  },

  getFeedback: (jobId: string) =>
    request<{ feedback: FeedbackEntry[] }>(`/jobs/${jobId}/feedback`),

  submitFeedback: (jobId: string, payload: FeedbackSubmission) =>
    request<{ feedback: FeedbackEntry }>(`/jobs/${jobId}/feedback`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
