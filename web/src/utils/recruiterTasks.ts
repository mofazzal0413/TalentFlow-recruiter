import type {
  Candidate,
  RecruiterTask,
  ResumeExtractStatus,
  SchedulingDraft,
  UncertaintyFlag,
  WorkflowStep,
} from "../types";

interface BuildRecruiterTasksInput {
  candidates: Candidate[];
  candidatesFetched: boolean;
  resumeFlags: Record<string, string[]>;
  resumeStatus: Record<string, ResumeExtractStatus>;
  uncertaintyFlags: UncertaintyFlag[];
  currentStep: WorkflowStep;
  workflowStopped: boolean;
  schedulingDrafts: SchedulingDraft[];
  allResumesExtracted: boolean;
}

export function buildRecruiterTasks(input: BuildRecruiterTasksInput): RecruiterTask[] {
  const tasks: RecruiterTask[] = [];

  if (input.currentStep === "candidates" && !input.candidatesFetched && input.candidates.length === 0) {
    tasks.push({
      id: "fetch-candidates",
      type: "resume-pending",
      title: "Start AI candidate pull",
      detail: "Click Fetch Candidates to load applicants from the ATS for this role.",
      priority: "medium",
      actionLabel: "Go to candidates",
      step: "candidates",
    });
  }

  const pendingExtraction = input.candidates.filter(
    (candidate) => (input.resumeStatus[candidate.id] ?? "idle") !== "complete",
  );
  if (pendingExtraction.length > 0 && input.currentStep === "resumes") {
    tasks.push({
      id: "resume-pending",
      type: "resume-pending",
      title: "Resumes awaiting extraction",
      detail: `${pendingExtraction.length} candidate${pendingExtraction.length === 1 ? "" : "s"} still need AI extraction.`,
      priority: "medium",
      actionLabel: "Go to extraction",
      step: "resumes",
    });
  }

  for (const candidate of input.candidates) {
    const flags = input.resumeFlags[candidate.id] ?? [];
    if (flags.length === 0 || input.resumeStatus[candidate.id] !== "complete") continue;

    const isSuspicious = flags.some((flag) =>
      flag.toLowerCase().includes("suspicious"),
    );

    tasks.push({
      id: `resume-flag-${candidate.id}`,
      type: "resume-flag",
      title: `Review resume — ${candidate.name}`,
      detail: flags.join(" · "),
      priority: isSuspicious ? "high" : "medium",
      actionLabel: "Review resumes",
      step: "resumes",
    });
  }

  for (const flag of input.uncertaintyFlags) {
    tasks.push({
      id: `uncertainty-${flag.candidate_id}-${flag.issue}`,
      type: "uncertainty",
      title: `Clarify — ${flag.candidate}`,
      detail: `${flag.issue} — ${flag.clarification_needed}`,
      priority: "high",
      actionLabel: "Review evaluation",
      step: "evaluation",
    });
  }

  if (input.currentStep === "checkpoint" && !input.workflowStopped) {
    tasks.push({
      id: "checkpoint-pending",
      type: "checkpoint",
      title: "Checkpoint approval required",
      detail: "Approve or stop the workflow before scheduling drafts are finalized.",
      priority: "high",
      actionLabel: "Open checkpoint",
      step: "checkpoint",
    });
  }

  if (input.schedulingDrafts.length > 0 && input.currentStep === "scheduling") {
    tasks.push({
      id: "scheduling-drafts",
      type: "scheduling-draft",
      title: "Send scheduling drafts",
      detail: `${input.schedulingDrafts.length} draft email${input.schedulingDrafts.length === 1 ? "" : "s"} ready for human review and send.`,
      priority: "medium",
      actionLabel: "Review drafts",
      step: "scheduling",
    });
  }

  if (
    input.allResumesExtracted &&
    input.currentStep === "resumes" &&
    input.candidates.length > 0
  ) {
    tasks.push({
      id: "continue-evaluation",
      type: "resume-pending",
      title: "Continue to fit evaluation",
      detail: "All resumes extracted. Proceed when human review of flags is complete.",
      priority: "medium",
      actionLabel: "Go to evaluation prep",
      step: "resumes",
    });
  }

  const priorityOrder = { high: 0, medium: 1 };
  return tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
