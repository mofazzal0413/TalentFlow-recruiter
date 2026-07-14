import type { Job, WorkflowStep } from "../types";

export type TimelineStepStatus = "pending" | "active" | "complete" | "stopped";

export interface TimelineStep {
  step: number;
  id: WorkflowStep;
  label: string;
  status: TimelineStepStatus;
  detail: string;
}

export interface WorkflowTimelineInput {
  selectedJob: Job | null;
  currentStep: WorkflowStep;
  candidatesFetched: boolean;
  candidatesCount: number;
  extractedCount: number;
  allResumesExtracted: boolean;
  anyExtracting: boolean;
  shortlistCount: number;
  checkpointApproved: boolean | null;
  workflowStopped: boolean;
  schedulingDraftsCount: number;
}

export function buildWorkflowTimeline(input: WorkflowTimelineInput): TimelineStep[] {
  const jobSelected = Boolean(input.selectedJob);

  const candidatesComplete = input.candidatesFetched;
  const resumesComplete = input.allResumesExtracted;
  const evaluationComplete = input.shortlistCount > 0;
  const checkpointComplete = input.checkpointApproved === true;
  const schedulingComplete = input.schedulingDraftsCount > 0;

  function statusFor(
    stepId: WorkflowStep,
    complete: boolean,
    prerequisitesMet: boolean,
  ): TimelineStepStatus {
    if (stepId === "checkpoint" && input.workflowStopped) {
      return "stopped";
    }
    if (complete) return "complete";
    if (input.currentStep === stepId) return "active";
    if (!prerequisitesMet) return "pending";
    if (stepId === "resumes" && input.anyExtracting) return "active";
    return "pending";
  }

  const jobDetail = input.selectedJob
    ? `${input.selectedJob.title} selected`
    : "Choose a role from the sidebar";

  const candidatesDetail = !candidatesComplete
    ? input.currentStep === "candidates"
      ? "Fetch applicants from the ATS"
      : "Not started"
    : input.candidatesCount === 0
      ? "No applicants returned"
      : `${input.candidatesCount} candidate${input.candidatesCount === 1 ? "" : "s"} loaded`;

  const resumesDetail = !input.candidatesCount
    ? "Waiting for candidates"
    : resumesComplete
      ? `${input.extractedCount} of ${input.candidatesCount} resumes extracted`
      : input.anyExtracting
        ? `Extracting ${input.extractedCount} of ${input.candidatesCount}…`
        : `${input.extractedCount} of ${input.candidatesCount} extracted`;

  const evaluationDetail = evaluationComplete
    ? `${input.shortlistCount} candidate${input.shortlistCount === 1 ? "" : "s"} ranked`
    : input.currentStep === "evaluation"
      ? "Run fit evaluation"
      : "Not started";

  let checkpointDetail = "Review shortlist before scheduling";
  if (input.workflowStopped) {
    checkpointDetail = "Workflow stopped — no scheduling";
  } else if (checkpointComplete) {
    checkpointDetail = "Approved — proceed to scheduling";
  } else if (input.checkpointApproved === false) {
    checkpointDetail = "Rejected at checkpoint";
  } else if (input.currentStep === "checkpoint") {
    checkpointDetail = "Awaiting your approval";
  }

  const schedulingDetail = schedulingComplete
    ? `${input.schedulingDraftsCount} draft email${input.schedulingDraftsCount === 1 ? "" : "s"} ready`
    : input.workflowStopped
      ? "Skipped — workflow stopped"
      : input.currentStep === "scheduling"
        ? "Review proposed slots and drafts"
        : checkpointComplete
          ? "Generate draft outreach"
          : "Not started";

  return [
    {
      step: 1,
      id: "job-selection",
      label: "Job selected",
      status: statusFor("job-selection", jobSelected, true),
      detail: jobDetail,
    },
    {
      step: 2,
      id: "candidates",
      label: "Candidates fetched",
      status: statusFor("candidates", candidatesComplete, jobSelected),
      detail: candidatesDetail,
    },
    {
      step: 3,
      id: "resumes",
      label: "Resume extracted",
      status: statusFor("resumes", resumesComplete, candidatesComplete && input.candidatesCount > 0),
      detail: resumesDetail,
    },
    {
      step: 4,
      id: "evaluation",
      label: "Fit evaluated",
      status: statusFor("evaluation", evaluationComplete, resumesComplete),
      detail: evaluationDetail,
    },
    {
      step: 5,
      id: "checkpoint",
      label: "Human checkpoint",
      status: statusFor("checkpoint", checkpointComplete, evaluationComplete),
      detail: checkpointDetail,
    },
    {
      step: 6,
      id: "scheduling",
      label: "Scheduling draft",
      status: statusFor(
        "scheduling",
        schedulingComplete,
        checkpointComplete && !input.workflowStopped,
      ),
      detail: schedulingDetail,
    },
  ];
}
