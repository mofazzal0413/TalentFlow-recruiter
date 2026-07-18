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

const MINIMIZED_STORAGE_KEY = "talentflow-debug-panel-minimized";

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
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem(MINIMIZED_STORAGE_KEY) === "true",
  );

  if (!import.meta.env.DEV) return null;

  function setMinimizedPersisted(value: boolean) {
    setMinimized(value);
    localStorage.setItem(MINIMIZED_STORAGE_KEY, String(value));
  }

  const activeError = error ?? jobsError;

  if (minimized) {
    return (
      <button
        type="button"
        className="workflow-debug-minimized-badge"
        onClick={() => setMinimizedPersisted(false)}
        aria-label="Restore workflow debug panel"
        title="Restore debug panel"
      >
        🐞 Debug{activeError ? " ⚠️" : ""}
      </button>
    );
  }

  const steps = getWorkflowStepsForBar();

  return (
    <aside
      className={`workflow-debug-panel ${collapsed ? "workflow-debug-panel--collapsed" : ""}`}
      aria-label="Workflow debug"
    >
      <header className="workflow-debug-header">
        <strong>Debug Panel</strong>
        <div className="workflow-debug-header-actions">
          <button
            type="button"
            className="workflow-debug-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            className="workflow-debug-toggle workflow-debug-minimize"
            onClick={() => setMinimizedPersisted(true)}
            aria-label="Minimize debug panel"
            title="Minimize"
          >
            —
          </button>
        </div>
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
