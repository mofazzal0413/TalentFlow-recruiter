import type { StepOwner, WorkflowStep } from "../types";

/** Spec-facing camelCase keys mapped to internal workflow step ids. */
export type WorkflowStepKey =
  | "jobSelection"
  | "fetchCandidates"
  | "resumeExtraction"
  | "fitEvaluation"
  | "checkpoint"
  | "schedulingDraft";

export interface WorkflowStepConfig {
  key: WorkflowStepKey;
  id: WorkflowStep;
  label: string;
  type: StepOwner;
  tooltip: string;
}

export const WORKFLOW_STEP_CONFIG: WorkflowStepConfig[] = [
  {
    key: "jobSelection",
    id: "job-selection",
    label: "Job Selection",
    type: "human",
    tooltip:
      "Choose the open role you want to screen. You pick the job; the agent loads its criteria.",
  },
  {
    key: "fetchCandidates",
    id: "candidates",
    label: "Fetch Candidates",
    type: "ai",
    tooltip: "AI pulls applicants from the ATS for this role and prepares them for resume review.",
  },
  {
    key: "resumeExtraction",
    id: "resumes",
    label: "Resume Extraction",
    type: "ai",
    tooltip:
      "AI extracts skills, experience, and flags from each resume — including PDF, DOCX, and text files.",
  },
  {
    key: "fitEvaluation",
    id: "evaluation",
    label: "Fit Evaluation",
    type: "ai",
    tooltip:
      "AI scores each candidate against must-have and nice-to-have requirements, then ranks the shortlist.",
  },
  {
    key: "checkpoint",
    id: "checkpoint",
    label: "Checkpoint",
    type: "human",
    tooltip:
      "You review the shortlist, flags, and summary. Approve to continue or stop the workflow.",
  },
  {
    key: "schedulingDraft",
    id: "scheduling",
    label: "Scheduling Draft",
    type: "ai",
    tooltip:
      "AI proposes interview slots and drafts outreach email text. Nothing is sent automatically.",
  },
];

export const WORKFLOW_STEP_ORDER: WorkflowStep[] = WORKFLOW_STEP_CONFIG.map((step) => step.id);

const KEY_BY_ID = Object.fromEntries(
  WORKFLOW_STEP_CONFIG.map((step) => [step.id, step.key]),
) as Record<WorkflowStep, WorkflowStepKey>;

const ID_BY_KEY = Object.fromEntries(
  WORKFLOW_STEP_CONFIG.map((step) => [step.key, step.id]),
) as Record<WorkflowStepKey, WorkflowStep>;

export type WorkflowStepVisualState = "active" | "completed" | "locked";

export function workflowStepToKey(step: WorkflowStep): WorkflowStepKey {
  return KEY_BY_ID[step];
}

export function keyToWorkflowStep(key: WorkflowStepKey): WorkflowStep {
  return ID_BY_KEY[key];
}

export function getWorkflowStepIndex(step: WorkflowStep): number {
  return WORKFLOW_STEP_ORDER.indexOf(step);
}

export function getWorkflowStepState(
  step: WorkflowStep,
  currentStep: WorkflowStep,
): WorkflowStepVisualState {
  const stepIndex = getWorkflowStepIndex(step);
  const currentIndex = getWorkflowStepIndex(currentStep);
  if (stepIndex === currentIndex) return "active";
  if (currentIndex >= 0 && stepIndex < currentIndex) return "completed";
  return "locked";
}

export function getNextWorkflowStep(step: WorkflowStep): WorkflowStep | null {
  const index = getWorkflowStepIndex(step);
  if (index < 0 || index >= WORKFLOW_STEP_ORDER.length - 1) return null;
  return WORKFLOW_STEP_ORDER[index + 1];
}

export function getPreviousWorkflowStep(step: WorkflowStep): WorkflowStep | null {
  const index = getWorkflowStepIndex(step);
  if (index <= 0) return null;
  return WORKFLOW_STEP_ORDER[index - 1];
}

/** UI export matching the product spec (label + human/ai type). */
export function getWorkflowStepsForBar() {
  return WORKFLOW_STEP_CONFIG.map(({ id, label, type, tooltip, key }) => ({
    id,
    key,
    label,
    type,
    tooltip,
  }));
}
