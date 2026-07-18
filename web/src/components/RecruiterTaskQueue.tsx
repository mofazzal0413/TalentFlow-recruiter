import { useState } from "react";
import type { RecruiterTask, WorkflowStep } from "../types";
import { WORKFLOW_STEPS } from "../types";
import "./RecruiterTaskQueue.css";

interface RecruiterTaskQueueProps {
  tasks: RecruiterTask[];
  onNavigate: (step: WorkflowStep) => void;
  /**
   * Some tasks (e.g. "fetch candidates", "continue to evaluation") surface while
   * you're already on their target step — navigating there is a no-op and the
   * button looks broken. `actions[task.id]` lets a task trigger the real
   * side-effecting call instead of just re-setting the current step.
   */
  actions?: Record<string, () => void>;
}

export function RecruiterTaskQueue({ tasks, onNavigate, actions }: RecruiterTaskQueueProps) {
  const [open, setOpen] = useState(true);
  const aiSteps = WORKFLOW_STEPS.filter((step) => step.owner === "ai").length;
  const aiPercent = Math.round((aiSteps / WORKFLOW_STEPS.length) * 100);
  const humanPercent = 100 - aiPercent;

  return (
    <section className={`task-queue section-card ${tasks.length > 0 ? "task-queue--active" : ""}`}>
      <header className="task-queue-header">
        <button type="button" className="task-queue-toggle" onClick={() => setOpen(!open)}>
          <div>
            <h2>Recruiter Task Queue</h2>
            <p className="task-queue-subtitle">
              {tasks.length > 0 ? (
                <>
                  <strong>{tasks.length}</strong> human task{tasks.length === 1 ? "" : "s"} ·{" "}
                  {aiPercent}% AI / {humanPercent}% Human
                </>
              ) : (
                <>
                  Workflow split: <strong>{aiPercent}% AI</strong> · <strong>{humanPercent}% Human</strong>
                </>
              )}
            </p>
          </div>
          <div className="task-queue-header-right">
            {tasks.length > 0 ? (
              <span className="task-queue-count">{tasks.length}</span>
            ) : (
              <span className="task-queue-clear">All clear</span>
            )}
            <span className="task-queue-chevron">{open ? "▾" : "▸"}</span>
          </div>
        </button>
      </header>

      {open && tasks.length === 0 && (
        <p className="task-queue-empty">
          No human tasks right now. AI is handling extraction, scoring, and drafts.
        </p>
      )}

      {open && tasks.length > 0 && (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task-item task-item--${task.priority}`}>
              <div className="task-item-body">
                <span className={`task-priority task-priority--${task.priority}`}>
                  {task.priority === "high" ? "High" : "Medium"}
                </span>
                <p className="task-title">{task.title}</p>
                <p className="task-detail">{task.detail}</p>
              </div>
              {task.actionLabel && task.step && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const action = actions?.[task.id];
                    if (action) {
                      action();
                    } else {
                      onNavigate(task.step!);
                    }
                  }}
                >
                  {task.actionLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
