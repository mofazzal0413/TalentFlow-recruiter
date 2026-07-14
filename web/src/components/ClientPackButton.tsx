import type { FeedbackEntry, Job, ShortlistItem, UncertaintyFlag } from "../types";
import { downloadClientPack } from "../utils/clientPack";
import "./ClientPackButton.css";

interface ClientPackButtonProps {
  job: Job;
  shortlist: ShortlistItem[];
  borderline: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  feedback: FeedbackEntry[];
  disabled?: boolean;
}

export function ClientPackButton({
  job,
  shortlist,
  borderline,
  uncertaintyFlags,
  feedback,
  disabled = false,
}: ClientPackButtonProps) {
  return (
    <div className="client-pack">
      <div className="client-pack-info">
        <h3>Client Submission Pack</h3>
        <p>Export ranked shortlist, borderline candidates, flags, and feedback for the hiring manager.</p>
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled || shortlist.length === 0}
        onClick={() =>
          downloadClientPack({ job, shortlist, borderline, uncertaintyFlags, feedback })
        }
      >
        Export Client Pack
      </button>
    </div>
  );
}
