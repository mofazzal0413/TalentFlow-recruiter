import { useEffect, useMemo, useState } from "react";
import type { SchedulingDraft } from "../types";
import { validateSchedulingDrafts } from "../utils/validators";
import { ErrorBanner } from "./ErrorBanner";
import "./SchedulingPanel.css";

interface SchedulingPanelProps {
  drafts: SchedulingDraft[];
}

export function SchedulingPanel({ drafts }: SchedulingPanelProps) {
  const draftValidation = useMemo(() => validateSchedulingDrafts(drafts), [drafts]);
  const safeDrafts = draftValidation.ok && draftValidation.data ? draftValidation.data : [];

  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setEditedEmails(
      Object.fromEntries(safeDrafts.map((d) => [d.candidate_id, d.draft_email])),
    );
  }, [safeDrafts]);

  async function copyEmail(candidateId: string) {
    await navigator.clipboard.writeText(editedEmails[candidateId] ?? "");
    setCopiedId(candidateId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!draftValidation.ok) {
    return (
      <ErrorBanner message="Agent output malformed. Scheduling draft or calendar slots failed validation — please retry." />
    );
  }

  if (!safeDrafts.length) {
    return (
      <div className="section-card">
        <h2>Scheduling Draft</h2>
        <p className="empty-state">No strong candidates met the bar for scheduling.</p>
      </div>
    );
  }

  return (
    <div className="scheduling-panel">
      {safeDrafts.map((draft) => (
        <div key={draft.candidate_id} className="section-card">
          <h2>{draft.name}</h2>
          <p className="scheduling-email">{draft.email}</p>
          <div className="slots">
            <h3>Proposed Slots</h3>
            <ul>
              {draft.proposed_slots.map((slot) => (
                <li key={slot}>{slot}</li>
              ))}
            </ul>
          </div>
          <div className="draft-email">
            <div className="draft-email-header">
              <h3>Draft Email</h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyEmail(draft.candidate_id)}
              >
                {copiedId === draft.candidate_id ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="draft-hint">Edit the draft before copying or sending.</p>
            <textarea
              value={editedEmails[draft.candidate_id] ?? draft.draft_email}
              onChange={(e) =>
                setEditedEmails((prev) => ({
                  ...prev,
                  [draft.candidate_id]: e.target.value,
                }))
              }
              rows={12}
              aria-label={`Draft email for ${draft.name}`}
            />
            <p className="draft-note">Draft only — not sent.</p>
          </div>
        </div>
      ))}
    </div>
  );
}
