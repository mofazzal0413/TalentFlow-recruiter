import { useEffect, useRef, useState } from "react";
import {
  getWorkflowStepIndex,
  getWorkflowStepState,
  getWorkflowStepsForBar,
} from "../config/workflowStateMachine";
import type { WorkflowStep } from "../types";
import { SafetyPanel } from "./SafetyPanel";
import "./AgentStatusBar.css";

interface AgentStatusBarProps {
  currentStep: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
}

export function AgentStatusBar({ currentStep, onStepClick }: AgentStatusBarProps) {
  const steps = getWorkflowStepsForBar();
  const currentIndex = getWorkflowStepIndex(currentStep);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousStep = useRef(currentStep);

  useEffect(() => {
    if (previousStep.current === currentStep) return;
    setIsAnimating(true);
    previousStep.current = currentStep;
    const timer = window.setTimeout(() => setIsAnimating(false), 450);
    return () => window.clearTimeout(timer);
  }, [currentStep]);

  const progressPercent =
    currentIndex >= 0
      ? Math.round(((currentIndex + 1) / steps.length) * 100)
      : 0;

  return (
    <div
      className={`workflow-bar status-bar ${isAnimating ? "status-bar--animating" : ""}`}
      data-current-step={currentStep}
    >
      <div className="workflow-bar-legend" aria-label="Step type legend">
        <span className="workflow-legend-item workflow-legend-item--human" title="Human decision required">
          <span aria-hidden="true">👤</span> Human — you decide
        </span>
        <span className="workflow-legend-item workflow-legend-item--ai" title="AI automated step">
          <span aria-hidden="true">⚙️</span> AI — automated
        </span>
      </div>

      <div className="status-bar-inner workflow-bar-inner">
        {steps.map((step, index) => {
          const stepState = getWorkflowStepState(step.id, currentStep);
          const isCompleted = stepState === "completed";
          const isLocked = stepState === "locked";
          const canNavigate = isCompleted && onStepClick;

          return (
            <div
              key={step.id}
              className={`status-step-wrap ${isAnimating && stepState === "active" ? "status-step-wrap--pulse" : ""}`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {index > 0 && (
                <span
                  className={`status-connector ${isCompleted || stepState === "active" ? "status-connector--done" : ""} ${isAnimating && (isCompleted || stepState === "active") ? "status-connector--animating" : ""}`}
                  style={{ transitionDelay: `${index * 50}ms` }}
                />
              )}
              <button
                type="button"
                className={[
                  "workflow-step",
                  "status-step",
                  stepState,
                  stepState === "completed" ? "completed" : "",
                  stepState === "locked" ? "locked" : "",
                  `status-step--${step.type}`,
                  isLocked ? "status-step--locked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={canNavigate ? () => onStepClick(step.id) : undefined}
                disabled={!canNavigate}
                aria-current={stepState === "active" ? "step" : undefined}
                aria-disabled={isLocked || undefined}
                aria-label={`${step.label} — ${step.type === "ai" ? "AI" : "Human"} step. ${step.tooltip}`}
                title={step.tooltip}
              >
                <span className="status-tooltip" role="tooltip">
                  {step.tooltip}
                </span>
                <span className="status-dot workflow-step-marker">
                  {isCompleted ? (
                    <span className="status-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="status-step-text workflow-step-text">
                  <span className="status-label step-label">{step.label}</span>
                  <div className="workflow-step-type">
                    {step.type === "human" ? (
                      <span
                        className="workflow-step-type-label workflow-step-type-label--human"
                        title="Human decision required"
                      >
                        👤 Human
                      </span>
                    ) : (
                      <span
                        className="workflow-step-type-label workflow-step-type-label--ai"
                        title="AI automated step"
                      >
                        ⚙️ AI
                      </span>
                    )}
                  </div>
                </div>
                {isLocked && <span className="status-lock" aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="status-bar-track" aria-hidden="true">
        <div
          className="status-bar-track-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <SafetyPanel />
    </div>
  );
}
