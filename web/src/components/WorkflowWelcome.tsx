import { WORKFLOW_STEPS } from "../types";
import "./WorkflowWelcome.css";

interface WorkflowWelcomeProps {
  openRoleCount: number;
}

const WELCOME_STEPS = WORKFLOW_STEPS.filter((step) => step.id !== "job-selection");

export function WorkflowWelcome({ openRoleCount }: WorkflowWelcomeProps) {
  return (
    <section className="workflow-welcome">
      <header className="workflow-welcome-header">
        <h1>Select a job to begin</h1>
        <p>
          Pick an open role from the sidebar, then start the screening workflow. The agent
          handles extraction and evaluation — you stay in control at every human checkpoint.
        </p>
        {openRoleCount > 0 && (
          <p className="workflow-welcome-roles">
            <strong>{openRoleCount}</strong> open {openRoleCount === 1 ? "role" : "roles"} in
            the sidebar
          </p>
        )}
      </header>

      <div className="workflow-welcome-grid">
        <div className="section-card workflow-welcome-card">
          <h2>What happens next</h2>
          <ol className="workflow-welcome-steps">
            <li className="workflow-welcome-step workflow-welcome-step--human">
              <span className="workflow-welcome-step-icon" aria-hidden="true">
                👤
              </span>
              <div>
                <strong>Select a role</strong>
                <p>Choose a job from the sidebar and click Start Workflow.</p>
              </div>
            </li>
            {WELCOME_STEPS.map((step) => (
              <li
                key={step.id}
                className={`workflow-welcome-step workflow-welcome-step--${step.owner}`}
              >
                <span className="workflow-welcome-step-icon" aria-hidden="true">
                  {step.owner === "ai" ? "⚙️" : "👤"}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.tooltip}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="section-card workflow-welcome-safety">
          <h2>Safety & control</h2>
          <p className="workflow-welcome-safety-lead">
            AI will never contact candidates without your approval.
          </p>
          <ul className="workflow-welcome-safety-list">
            <li>All outreach is draft-only until you copy and send manually.</li>
            <li>A human checkpoint is required before any scheduling step.</li>
            <li>You can stop the workflow at any time with a single No.</li>
            <li>Uncertainty flags surface anything that needs your review.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
