import type { ShortlistItem, UncertaintyFlag } from "../types";
import "./CheckpointModal.css";

interface CheckpointModalProps {
  open: boolean;
  shortlist: ShortlistItem[];
  borderline: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  strongCount: number;
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function CheckpointModal({
  open,
  shortlist,
  borderline,
  uncertaintyFlags,
  strongCount,
  loading,
  onApprove,
  onReject,
}: CheckpointModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Human Approval Required</h2>
        <p className="modal-intro">
          Review the agent output before proceeding. No emails will be sent and no ATS
          updates will be made until you approve.
        </p>

        <div className="modal-section">
          <h3>Summary</h3>
          <ul className="modal-summary">
            <li>{shortlist.length} candidates evaluated</li>
            <li>{strongCount} strong candidates ready for scheduling</li>
            <li>{borderline.length} borderline candidates</li>
            <li>{uncertaintyFlags.length} uncertainty flags</li>
          </ul>
        </div>

        {uncertaintyFlags.length > 0 && (
          <div className="modal-section">
            <h3>Flags to review</h3>
            <ul className="modal-flags">
              {uncertaintyFlags.slice(0, 3).map((flag, index) => (
                <li key={`${flag.candidate_id}-${index}`}>
                  {flag.candidate}: {flag.issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {shortlist.length > 0 && (
          <div className="modal-section">
            <h3>Top ranked candidates</h3>
            <ul className="modal-summary">
              {shortlist.slice(0, 3).map((item) => (
                <li key={item.candidate_id}>
                  [{item.rank}] {item.name} — {item.match_score}% —{" "}
                  {item.meets_bar ? "Meets bar" : "Below bar"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="modal-draft-note">Scheduling drafts only. Nothing will be sent until you copy and send manually.</p>

        <div className="modal-actions">
          <button type="button" className="btn btn-danger" onClick={onReject} disabled={loading}>
            No — Stop Workflow
          </button>
          <button type="button" className="btn btn-primary" onClick={onApprove} disabled={loading}>
            {loading ? "Processing…" : "Yes — Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
