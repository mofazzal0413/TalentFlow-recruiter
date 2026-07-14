import { useMemo, useState } from "react";
import type { WorkflowStep } from "../types";
import {
  buildWorkflowTimeline,
  type TimelineStep,
  type WorkflowTimelineInput,
} from "../utils/workflowTimeline";
import "./WorkflowTimeline.css";

interface WorkflowTimelineProps extends WorkflowTimelineInput {
  onNavigate?: (step: WorkflowStep) => void;
}

function circleClass(status: TimelineStep["status"]): string {
  if (status === "complete") return "done";
  if (status === "active") return "active";
  if (status === "stopped") return "pending";
  return "pending";
}

function statusLabel(status: TimelineStep["status"]): string {
  switch (status) {
    case "complete":
      return "Done";
    case "active":
      return "In progress";
    case "stopped":
      return "Stopped";
    default:
      return "Pending";
  }
}

export function WorkflowTimeline({
  selectedJob,
  currentStep,
  candidatesFetched,
  candidatesCount,
  extractedCount,
  allResumesExtracted,
  anyExtracting,
  shortlistCount,
  checkpointApproved,
  workflowStopped,
  schedulingDraftsCount,
  onNavigate,
}: WorkflowTimelineProps) {
  const [open, setOpen] = useState(true);
  const steps = useMemo(
    () =>
      buildWorkflowTimeline({
        selectedJob,
        currentStep,
        candidatesFetched,
        candidatesCount,
        extractedCount,
        allResumesExtracted,
        anyExtracting,
        shortlistCount,
        checkpointApproved,
        workflowStopped,
        schedulingDraftsCount,
      }),
    [
      selectedJob,
      currentStep,
      candidatesFetched,
      candidatesCount,
      extractedCount,
      allResumesExtracted,
      anyExtracting,
      shortlistCount,
      checkpointApproved,
      workflowStopped,
      schedulingDraftsCount,
    ],
  );

  const completedCount = steps.filter((step) => step.status === "complete").length;

  return (
    <section className="workflow-timeline section-card">
      <header className="workflow-timeline-header">
        <button
          type="button"
          className="workflow-timeline-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <div>
            <h2>Workflow Timeline</h2>
            <p className="workflow-timeline-subtitle">
              <strong>{completedCount}</strong> of {steps.length} steps complete
            </p>
          </div>
          <span className="workflow-timeline-collapse">{open ? "Collapse" : "Expand"}</span>
        </button>
      </header>

      {open && (
        <ol className="workflow-timeline-list timeline">
          {steps.map((item, index) => {
            const canNavigate =
              onNavigate &&
              (item.status === "complete" || item.status === "active") &&
              item.id !== "job-selection";

            return (
              <li
                key={item.id}
                className={`workflow-timeline-item timeline-step workflow-timeline-item--${item.status}`}
              >
                {index < steps.length - 1 && (
                  <span
                    className={`workflow-timeline-line ${
                      item.status === "complete" ? "workflow-timeline-line--done" : ""
                    }`}
                    aria-hidden="true"
                  />
                )}
                {canNavigate ? (
                  <button
                    type="button"
                    className="workflow-timeline-step-btn"
                    onClick={() => onNavigate(item.id)}
                  >
                    <TimelineStepContent item={item} />
                  </button>
                ) : (
                  <div className="workflow-timeline-step">
                    <TimelineStepContent item={item} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function TimelineStepContent({ item }: { item: TimelineStep }) {
  return (
    <>
      <span
        className={`circle workflow-timeline-marker workflow-timeline-marker--${item.status} ${circleClass(item.status)}`}
      >
        {item.status === "complete" ? "✓" : item.step}
      </span>
      <div className="workflow-timeline-content">
        <div className="workflow-timeline-row">
          <span className="workflow-timeline-label">
            Step {item.step}: {item.label}
          </span>
          <span className={`workflow-timeline-badge workflow-timeline-badge--${item.status}`}>
            {statusLabel(item.status)}
          </span>
        </div>
        <p className="workflow-timeline-detail">{item.detail}</p>
      </div>
    </>
  );
}
