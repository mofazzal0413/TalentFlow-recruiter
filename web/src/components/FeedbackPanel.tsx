import { useState, type FormEvent } from "react";
import type { Candidate, FeedbackEntry, FeedbackSubmission } from "../types";
import "./FeedbackPanel.css";

interface FeedbackPanelProps {
  candidates: Candidate[];
  feedback: FeedbackEntry[];
  loading: boolean;
  onSubmit: (payload: FeedbackSubmission) => Promise<void>;
}

export function FeedbackPanel({
  candidates,
  feedback,
  loading,
  onSubmit,
}: FeedbackPanelProps) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const [correctedScore, setCorrectedScore] = useState("");
  const [meetsBar, setMeetsBar] = useState<boolean | null>(null);
  const [technical, setTechnical] = useState("3");
  const [communication, setCommunication] = useState("3");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const selected = candidates.find((c) => c.id === candidateId);
    if (!selected) return;
    await onSubmit({
      candidate_id: selected.id,
      candidate_name: selected.name,
      comment: comment.trim(),
      corrected_match_score: correctedScore ? Number(correctedScore) : null,
      corrected_meets_bar: meetsBar,
      scorecard: { technical: Number(technical), communication: Number(communication) },
    });
    setComment("");
    setCorrectedScore("");
    setMeetsBar(null);
  }

  return (
    <div className="feedback-panel section-card">
      <h2>Recruiter Feedback</h2>
      <p className="feedback-intro">
        Submit evaluation corrections. Applied on the next evaluation run.
      </p>

      {feedback.length > 0 && (
        <div className="feedback-history">
          <h3>Previous Feedback</h3>
          <ul>
            {feedback.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.candidate_name}</strong>
                {entry.corrected_match_score !== null && (
                  <span> → {entry.corrected_match_score}%</span>
                )}
                <p>{entry.comment || "Scorecard update submitted."}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="feedback-form" onSubmit={handleSubmit}>
        <label>
          Candidate
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            disabled={loading || !candidates.length}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="feedback-row">
          <label>
            Technical (1–5)
            <input type="number" min={1} max={5} value={technical} onChange={(e) => setTechnical(e.target.value)} />
          </label>
          <label>
            Communication (1–5)
            <input type="number" min={1} max={5} value={communication} onChange={(e) => setCommunication(e.target.value)} />
          </label>
        </div>

        <label>
          Corrected Match Score (%)
          <input
            type="number"
            min={0}
            max={100}
            value={correctedScore}
            onChange={(e) => setCorrectedScore(e.target.value)}
            placeholder="Optional"
          />
        </label>

        <label>
          Correction notes
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required={!correctedScore}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Submitting…" : "Submit Correction"}
        </button>
      </form>
    </div>
  );
}
