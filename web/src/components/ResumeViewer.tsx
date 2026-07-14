import { useEffect, useState } from "react";
import type { ResumeData, ResumeExtractStatus } from "../types";
import { validateResume } from "../utils/validators";
import { ErrorBanner } from "./ErrorBanner";
import "./ResumeViewer.css";

interface ResumeViewerProps {
  candidateName: string;
  status: ResumeExtractStatus;
  resume?: ResumeData;
  missingFlags: string[];
  onExtract: () => void;
  extracting?: boolean;
  animationIndex?: number;
}

const STATUS_LABELS: Record<ResumeExtractStatus, string> = {
  idle: "Not extracted",
  extracting: "Extracting…",
  complete: "Extracted",
  error: "Failed",
};

export function ResumeViewer({
  candidateName,
  status,
  resume,
  missingFlags,
  onExtract,
  extracting = false,
  animationIndex = 0,
}: ResumeViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "complete" && missingFlags.length > 0) {
      setOpen(true);
    }
  }, [status, missingFlags]);

  const statusClass =
    status === "complete" && missingFlags.length === 0
      ? "resume-status--complete"
      : status === "complete" && missingFlags.length > 0
        ? "resume-status--warning"
        : status === "error"
          ? "resume-status--error"
          : status === "extracting"
            ? "resume-status--extracting"
            : "resume-status--idle";

  const resumeValidation = resume ? validateResume(resume) : { ok: true, errors: [] as string[] };
  const safeResume = resumeValidation.ok ? resume : undefined;

  return (
    <div
      className="resume-viewer animate-fade-in"
      style={{ animationDelay: `${animationIndex * 80}ms` }}
    >
      <div className="resume-viewer-header">
        <button
          type="button"
          className="resume-toggle"
          onClick={() => safeResume && setOpen(!open)}
          disabled={!safeResume}
        >
          <span className="resume-toggle-name">{candidateName}</span>
          <span className="resume-toggle-action">
            {safeResume ? (open ? "Hide details" : "Show details") : "Awaiting extraction"}
          </span>
        </button>

        <div className="resume-viewer-actions">
          <span className={`resume-status ${statusClass}`}>{STATUS_LABELS[status]}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onExtract}
            disabled={extracting || status === "extracting"}
          >
            {status === "complete" ? "Re-extract" : "Extract"}
          </button>
        </div>
      </div>

      {missingFlags.length > 0 && status === "complete" && (
        <div className="resume-flags">
          {missingFlags.map((flag) => (
            <span
              key={flag}
              className={`badge ${flag === "Suspicious content detected" ? "badge-danger" : "badge-warning"}`}
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      {!resumeValidation.ok && (
        <ErrorBanner message="Agent output malformed. Resume extraction failed validation — please re-extract." />
      )}

      {open && safeResume && (
        <div className="resume-content">
          <section className="resume-raw-section">
            <h3>
              Raw Extracted Text
              {safeResume.source_format && (
                <span className="resume-format"> ({safeResume.source_format.toUpperCase()})</span>
              )}
            </h3>
            <pre className="resume-raw-text">
              {safeResume.raw_text?.trim() || "No extracted text available."}
            </pre>
          </section>
          <section>
            <h3>Skills</h3>
            <p>{safeResume.skills?.length ? safeResume.skills.join(", ") : "—"}</p>
          </section>
          <section>
            <h3>Experience</h3>
            {safeResume.experience?.length ? (
              <ul>
                {safeResume.experience.map((item) => (
                  <li key={`${item.company}-${item.title}`}>
                    <strong>{item.title}</strong> at {item.company} ({item.years} yrs) — {item.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </section>
          <section>
            <h3>Education</h3>
            {safeResume.education?.length ? (
              <ul>
                {safeResume.education.map((item) => (
                  <li key={`${item.school}-${item.degree}`}>
                    {item.degree}, {item.school}
                  </li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
