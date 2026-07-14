import type { JobWorkflowSnapshot } from "../types";

export type RoleProgressStatus = "not-started" | "in-progress" | "checkpoint-pending";

export function getRoleProgressStatus(
  snapshot?: JobWorkflowSnapshot,
): RoleProgressStatus {
  if (!snapshot) return "not-started";
  if (snapshot.currentStep === "checkpoint" && !snapshot.workflowStopped) {
    return "checkpoint-pending";
  }
  if (
    snapshot.currentStep === "job-selection" ||
    (snapshot.currentStep === "candidates" && snapshot.candidateCount === 0)
  ) {
    return "not-started";
  }
  return "in-progress";
}

export function roleProgressLabel(status: RoleProgressStatus): string {
  switch (status) {
    case "not-started":
      return "Not started";
    case "in-progress":
      return "In progress";
    case "checkpoint-pending":
      return "Checkpoint pending";
  }
}

export function roleProgressActionLabel(status: RoleProgressStatus): string {
  switch (status) {
    case "not-started":
      return "Start Workflow";
    case "in-progress":
      return "Continue Workflow";
    case "checkpoint-pending":
      return "Review Checkpoint";
  }
}
