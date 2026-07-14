import type { ShortlistItem, UncertaintyFlag } from "../types";
import { ShortlistPanel } from "./ShortlistPanel";
import "./WorkflowStopped.css";

interface WorkflowStoppedProps {
  shortlist: ShortlistItem[];
  borderline: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  onRerunEvaluation: () => void;
  onStartOver: () => void;
}

export function WorkflowStopped({
  shortlist,
  borderline,
  uncertaintyFlags,
  onRerunEvaluation,
  onStartOver,
}: WorkflowStoppedProps) {
  return (
    <section className="workflow-stopped">
      <div className="workflow-stopped-banner">
        <h1>Workflow Stopped</h1>
        <p>
          You declined to proceed to scheduling. No emails were sent and no ATS
          updates were made.
        </p>
      </div>
      <ShortlistPanel
        shortlist={shortlist}
        uncertaintyFlags={uncertaintyFlags}
        borderline={borderline}
      />
      <div className="actions-row">
        <button type="button" className="btn btn-primary" onClick={onRerunEvaluation}>
          Re-run Evaluation
        </button>
        <button type="button" className="btn btn-secondary" onClick={onStartOver}>
          Start Over
        </button>
      </div>
    </section>
  );
}
