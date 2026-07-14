import type { ShortlistItem, UncertaintyFlag } from "../types";
import { SafetyPanel } from "./SafetyPanel";
import "./CheckpointScreen.css";

interface CheckpointScreenProps {
  shortlist: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  strongCount: number;
  loading: boolean;
  onApprove: () => void;
  onStop: () => void;
}

function candidateFlags(item: ShortlistItem, uncertaintyFlags: UncertaintyFlag[]): string[] {
  const flags = [...(item.uncertainty_flags ?? []), ...(item.mismatch_flags ?? [])];
  for (const flag of uncertaintyFlags) {
    if (flag.candidate_id === item.candidate_id && !flags.includes(flag.issue)) {
      flags.push(flag.issue);
    }
  }
  return flags;
}

export function CheckpointScreen({
  shortlist,
  uncertaintyFlags,
  strongCount,
  loading,
  onApprove,
  onStop,
}: CheckpointScreenProps) {
  return (
    <section className="checkpoint workflow-step-panel">
      <header className="page-header checkpoint-header">
        <h2>Checkpoint: Review Shortlist</h2>
        <p className="checkpoint-intro">
          Human approval required. Review ranked candidates and flags before scheduling.
        </p>
      </header>

      <div className="section-card checkpoint-card">
        <div className="checkpoint-summary">
          <span>{shortlist.length} evaluated</span>
          <span>{strongCount} strong</span>
          <span>{uncertaintyFlags.length} flags</span>
        </div>

        {shortlist.length === 0 ? (
          <p className="empty-state">No shortlist yet. Run evaluation first.</p>
        ) : (
          <ul className="checkpoint-list">
            {shortlist.map((candidate) => {
              const flags = candidateFlags(candidate, uncertaintyFlags);
              return (
                <li key={candidate.candidate_id} className="checkpoint-list-item">
                  <div className="checkpoint-candidate">
                    <strong>{candidate.name}</strong>
                    <span className="checkpoint-score">{candidate.match_score}%</span>
                    <span
                      className={`checkpoint-bar ${candidate.meets_bar ? "checkpoint-bar--yes" : "checkpoint-bar--no"}`}
                    >
                      {candidate.meets_bar ? "Meets bar" : "Below bar"}
                    </span>
                  </div>
                  {flags.length > 0 && (
                    <span className="flag">⚠️ {flags.join(", ")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="checkpoint-actions">
          <button
            type="button"
            className="approve btn btn-primary"
            onClick={onApprove}
            disabled={loading || shortlist.length === 0}
          >
            {loading ? "Processing…" : "Approve Shortlist"}
          </button>
          <button
            type="button"
            className="stop btn btn-secondary"
            onClick={onStop}
            disabled={loading}
          >
            Stop Workflow
          </button>
        </div>

        <p className="checkpoint-note">
          AI cannot proceed to scheduling until you approve.
        </p>

        <SafetyPanel compact />
      </div>
    </section>
  );
}
