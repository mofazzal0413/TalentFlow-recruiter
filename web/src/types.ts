export type WorkflowStep =
  | "job-selection"
  | "candidates"
  | "resumes"
  | "evaluation"
  | "checkpoint"
  | "scheduling";

export interface Job {
  id: string;
  title: string;
  department: string;
  level: string;
  status: string;
  location: string;
  candidate_count: number;
  description: string;
}

export interface JobRequirements {
  job_id: string;
  role: string;
  must_have: string[];
  nice_to_have: string[];
  ingestion_source: string;
  has_override?: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  status: string;
  stage?: string;
  resume_link?: string;
  tags?: string[];
}

export type ResumeExtractStatus = "idle" | "extracting" | "complete" | "error";

export interface ResumeData {
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    years: number;
    summary: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
  }>;
  raw_text?: string;
  source_format?: string;
  missing_fields?: string[];
  error?: string;
  suspicious_content?: boolean;
}

export interface ShortlistItem {
  candidate_id: string;
  name: string;
  rank: number;
  match_score: number;
  meets_bar: boolean;
  reason: string;
  uncertainty_flags: string[];
  mismatch_flags?: string[];
}

export interface UncertaintyFlag {
  issue: string;
  candidate: string;
  candidate_id: string;
  clarification_needed: string;
}

export interface SchedulingDraft {
  candidate_id: string;
  name: string;
  email: string;
  proposed_slots: string[];
  draft_email: string;
}

export interface FeedbackEntry {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  scorecard: { technical?: number; communication?: number };
  comment: string;
  corrected_match_score: number | null;
  corrected_meets_bar: boolean | null;
  submitted_at: string;
}

export interface FeedbackSubmission {
  candidate_id: string;
  candidate_name: string;
  comment: string;
  corrected_match_score?: number | null;
  corrected_meets_bar?: boolean | null;
  scorecard?: { technical?: number; communication?: number };
}

export interface AgentOutputSummary {
  action: string;
  summary: string;
  at: string;
}

import { WORKFLOW_STEP_CONFIG } from "./config/workflowStateMachine";

export type StepOwner = "ai" | "human";

export const WORKFLOW_STEPS: {
  id: WorkflowStep;
  label: string;
  owner: StepOwner;
  tooltip: string;
}[] = WORKFLOW_STEP_CONFIG.map((step) => ({
  id: step.id,
  label: step.label,
  owner: step.type,
  tooltip: step.tooltip,
}));

export interface JobWorkflowSnapshot {
  currentStep: WorkflowStep;
  humanTaskCount: number;
  candidateCount: number;
  flaggedResumeCount: number;
  workflowStopped: boolean;
  updatedAt: string;
}

export interface RecruiterTask {
  id: string;
  type: "resume-flag" | "resume-pending" | "uncertainty" | "checkpoint" | "scheduling-draft";
  title: string;
  detail: string;
  priority: "high" | "medium";
  actionLabel?: string;
  step?: WorkflowStep;
}
