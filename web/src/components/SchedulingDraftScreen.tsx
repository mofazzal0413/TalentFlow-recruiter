import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SchedulingDraft } from "../types";
import {
  validateCalendarSlots,
  validateDraftEmail,
  validateSchedulingDrafts,
} from "../utils/validators";
import { ErrorBanner } from "./ErrorBanner";
import "./SchedulingDraftScreen.css";

interface SchedulingDraftScreenProps {
  drafts: SchedulingDraft[];
  onFinish?: () => void;
}

export interface ParsedSlot {
  date: string;
  time: string;
  raw: string;
}

function parseProposedSlot(slot: string): ParsedSlot {
  const trimmed = slot.trim();
  if (!trimmed) {
    return { date: "—", time: "—", raw: slot };
  }

  if (trimmed.includes(" — ")) {
    const [date, time] = trimmed.split(" — ");
    return { date: date.trim(), time: time.trim(), raw: trimmed };
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if (match) {
    const [, isoDate, time] = match;
    const parsed = new Date(`${isoDate}T12:00:00`);
    const date = Number.isNaN(parsed.getTime())
      ? isoDate
      : parsed.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    return { date, time: time.trim(), raw: trimmed };
  }

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex > 0) {
    return {
      date: trimmed.slice(0, spaceIndex),
      time: trimmed.slice(spaceIndex + 1),
      raw: trimmed,
    };
  }

  return { date: trimmed, time: "", raw: trimmed };
}

function validateSingleDraft(draft: SchedulingDraft): boolean {
  const slotsOk = validateCalendarSlots({ proposed_slots: draft.proposed_slots }).ok;
  const emailOk = validateDraftEmail(draft.draft_email).ok;
  return slotsOk && emailOk;
}

function CandidateSchedulingDraft({
  draft,
}: {
  draft: SchedulingDraft;
}) {
  const [copiedSlot, setCopiedSlot] = useState<number | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const slots = useMemo(
    () => draft.proposed_slots.map(parseProposedSlot),
    [draft.proposed_slots],
  );

  const draftValid = validateSingleDraft(draft);

  async function copySlot(index: number, slot: ParsedSlot) {
    const text = slot.time ? `${slot.date} ${slot.time}` : slot.raw;
    await navigator.clipboard.writeText(text);
    setCopiedSlot(index);
    setTimeout(() => setCopiedSlot(null), 2000);
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(draft.draft_email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  if (!draftValid) {
    return (
      <ErrorBanner message="Scheduling data malformed. Please retry." />
    );
  }

  return (
    <article className="scheduling-draft-card">
      <header className="scheduling-draft-candidate">
        <h3>{draft.name}</h3>
        <p>{draft.email}</p>
      </header>

      <div className="slots-section">
        <h3>Proposed Interview Slots</h3>
        {slots.length === 0 ? (
          <p className="scheduling-empty">No slots available.</p>
        ) : (
          <ul className="slots-list">
            {slots.map((slot, index) => (
              <li key={`${slot.raw}-${index}`} className="slot-item">
                <span className="slot-text">
                  <strong>{slot.date}</strong>
                  {slot.time ? ` — ${slot.time}` : ""}
                </span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => copySlot(index, slot)}
                >
                  {copiedSlot === index ? "Copied" : "Copy Slot"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="email-section">
        <h3>Draft Outreach Email</h3>
        <textarea
          className="draft-email"
          value={draft.draft_email}
          readOnly
          aria-label={`Draft email for ${draft.name}`}
        />
        <button type="button" className="copy-btn" onClick={copyEmail}>
          {copiedEmail ? "Copied" : "Copy Email"}
        </button>
      </div>
    </article>
  );
}

export function SchedulingDraftScreen({ drafts, onFinish }: SchedulingDraftScreenProps) {
  const navigate = useNavigate();
  const batchValidation = useMemo(() => validateSchedulingDrafts(drafts), [drafts]);
  const safeDrafts = batchValidation.ok && batchValidation.data ? batchValidation.data : [];

  function handleFinish() {
    onFinish?.();
    navigate("/dashboard");
  }

  if (!batchValidation.ok) {
    return (
      <div className="screen scheduling-draft">
        <h2>Scheduling Draft</h2>
        <ErrorBanner message="Scheduling data malformed. Please retry." />
      </div>
    );
  }

  if (!safeDrafts.length) {
    return (
      <div className="screen scheduling-draft">
        <h2>Scheduling Draft</h2>
        <p className="scheduling-empty">No strong candidates met the bar for scheduling.</p>
        <div className="safety-note">
          <p>AI will never send emails automatically.</p>
          <p>All outreach is draft-only until you copy and send manually.</p>
        </div>
        <button type="button" className="finish-btn" onClick={handleFinish}>
          Finish & Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="screen scheduling-draft">
      <h2>Scheduling Draft</h2>
      <p className="scheduling-draft-intro">
        AI-proposed interview slots and draft outreach — review, copy, and send manually.
      </p>

      {safeDrafts.map((draft) => (
        <CandidateSchedulingDraft key={draft.candidate_id} draft={draft} />
      ))}

      <div className="safety-note">
        <p>AI will never send emails automatically.</p>
        <p>All outreach is draft-only until you copy and send manually.</p>
      </div>

      <button type="button" className="finish-btn" onClick={handleFinish}>
        Finish & Return to Dashboard
      </button>
    </div>
  );
}
