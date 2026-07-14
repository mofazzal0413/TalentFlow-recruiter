import type { ShortlistItem, UncertaintyFlag } from "../types";
import { validateShortlist } from "../utils/validators";
import { ErrorBanner } from "./ErrorBanner";
import "./ShortlistPanel.css";

interface ShortlistPanelProps {
  shortlist: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  borderline?: ShortlistItem[];
}

export function ShortlistPanel({
  shortlist,
  uncertaintyFlags,
  borderline = [],
}: ShortlistPanelProps) {
  const shortlistResult = validateShortlist(shortlist);
  const borderlineResult = validateShortlist(borderline);
  const safeShortlist = shortlistResult.ok ? shortlistResult.data! : [];
  const safeBorderline = borderlineResult.ok ? borderlineResult.data! : [];
  const validationErrors = [...shortlistResult.errors, ...borderlineResult.errors];

  return (
    <div className="shortlist-panel">
      {validationErrors.length > 0 && (
        <ErrorBanner message="Agent output malformed. Shortlist data failed validation — please retry evaluation." />
      )}

      <div className="section-card">
        <h2>Ranked Shortlist</h2>
        {safeShortlist.length === 0 ? (
          <p className="empty-state">No evaluation results yet.</p>
        ) : (
          <ul className="shortlist-list">
            {safeShortlist.map((item) => (
              <li key={item.candidate_id} className="shortlist-item">
                <div className="shortlist-header">
                  <span className="rank">#{item.rank}</span>
                  <span className="name">{item.name}</span>
                  <span className={`score ${item.meets_bar ? "strong" : ""}`}>
                    {item.match_score}%
                  </span>
                </div>
                <p className="reason">{item.reason}</p>
                {item.mismatch_flags && item.mismatch_flags.length > 0 && (
                  <ul className="mismatch-list">
                    {item.mismatch_flags.slice(0, 3).map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {safeBorderline.length > 0 && (
        <div className="section-card">
          <h2>Borderline Candidates</h2>
          <ul className="shortlist-list">
            {safeBorderline.map((item) => (
              <li key={item.candidate_id} className="shortlist-item borderline">
                <div className="shortlist-header">
                  <span className="name">{item.name}</span>
                  <span className="score">{item.match_score}%</span>
                </div>
                <p className="reason">{item.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {uncertaintyFlags.length > 0 && (
        <div className="section-card">
          <h2>Uncertainty Flags</h2>
          <ul className="flag-list">
            {uncertaintyFlags.map((flag, index) => (
              <li key={`${flag.candidate_id}-${index}`}>
                <strong>{flag.candidate}</strong> — {flag.issue}
                <span className="clarification">
                  Clarification needed: {flag.clarification_needed}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
