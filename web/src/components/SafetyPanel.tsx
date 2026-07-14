import "./SafetyPanel.css";

interface SafetyPanelProps {
  compact?: boolean;
}

export function SafetyPanel({ compact = false }: SafetyPanelProps) {
  return (
    <div className={`safety-panel ${compact ? "safety-panel--compact" : ""}`} role="note">
      <p>AI will never contact candidates without your approval.</p>
      <p>All outreach is draft-only until you copy and send manually.</p>
      <p>A human checkpoint is required before any scheduling step.</p>
    </div>
  );
}
