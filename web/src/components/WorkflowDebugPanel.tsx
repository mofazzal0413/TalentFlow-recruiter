import { useState } from "react";
import { getWorkflowStepState, getWorkflowStepsForBar, workflowStepToKey } from "../config/workflowStateMachine";
import type { AgentOutputSummary } from "../types";
import type { WorkflowStep } from "../types";
import "./WorkflowDebugPanel.css";

interface WorkflowDebugPanelProps {
  currentStep: WorkflowStep;
  selectedJobId: string | null;
  selectedJobTitle: string | null;
  workflowStopped: boolean;
  checkpointApproved: boolean | null;
  candidatesCount: number;
  shortlistCount: number;
  lastAgentOutput: AgentOutputSummary | null;
  error: string | null;
  jobsError: string | null;
}

export function WorkflowDebugPanel({
  currentStep,
  selectedJobId,
  selectedJobTitle,
  workflowStopped,
  checkpointApproved,
  candidatesCount,
  shortlistCount,
  lastAgentOutput,
  error,
  jobsError,
}: WorkflowDebugPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!import.meta.env.DEV) return null;

  const steps = getWorkflowStepsForBar();
  const activeError = error ?? jobsError;

  return (
    <aside
      className={`workflow-debug-panel ${collapsed ? "workflow-debug-panel--collapsed" : ""}`}
      aria-label="Workflow debug"
    >
      <header className="workflow-debug-header">
        <strong>Debug Panel</strong>
        <button
          type="button"
          className="workflow-debug-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </header>

      {!collapsed && (
        <>
          <div className="workflow-debug-row">
            <span className="workflow-debug-label">Step</span>
            <code>
              {currentStep} ({workflowStepToKey(currentStep)})
            </code>
          </div>
          <div className="workflow-debug-row">
            <span className="workflow-debug-label">Role</span>
            <span>
              {selectedJobTitle ?? "None"}
              {selectedJobId && (
                <>
                  {" "}
                  <code>({selectedJobId})</code>
                </>
              )}
            </span>
          </div>
          <div className="workflow-debug-row">
            <span className="workflow-debug-label">Last agent output</span>
            <span className="workflow-debug-agent">
              {lastAgentOutput ? (
                <>
                  <strong>{lastAgentOutput.action}</strong> — {lastAgentOutput.summary}
                </>
              ) : (
                "None yet"
              )}
            </span>
          </div>
          <div className="workflow-debug-row">
            <span className="workflow-debug-label">Errors</span>
            <span className={activeError ? "workflow-debug-error" : ""}>
              {activeError ?? "None"}
            </span>
          </div>
          <dl className="workflow-debug-grid">
            <div>
              <dt>checkpoint</dt>
              <dd>
                {checkpointApproved === null ? "pending" : checkpointApproved ? "approved" : "rejected"}
              </dd>
            </div>
            <div>
              <dt>workflowStopped</dt>
              <dd>{String(workflowStopped)}</dd>
            </div>
            <div>
              <dt>candidates</dt>
              <dd>{candidatesCount}</dd>
            </div>
            <div>
              <dt>shortlist</dt>
              <dd>{shortlistCount}</dd>
            </div>
          </dl>
          <ul className="workflow-debug-steps">
            {steps.map((step) => {
              const state = getWorkflowStepState(step.id, currentStep);
              return (
                <li key={step.id} className={`workflow-debug-step workflow-debug-step--${state}`}>
                  <span className="workflow-debug-step-name">{step.label}</span>
                  <span className="workflow-debug-step-state">{state}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
