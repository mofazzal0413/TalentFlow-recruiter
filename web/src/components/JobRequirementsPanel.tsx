import { useRef, useState } from "react";
import type { JobRequirements } from "../types";
import "./JobRequirementsPanel.css";

interface JobRequirementsPanelProps {
  requirements: JobRequirements | null;
  loading: boolean;
  importing: boolean;
  importMessage: string | null;
  onImport: (file: File) => Promise<void>;
  onRefresh: () => void;
}

export function JobRequirementsPanel({
  requirements,
  loading,
  importing,
  importMessage,
  onImport,
  onRefresh,
}: JobRequirementsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    void onImport(file);
  }

  return (
    <section className="job-requirements-panel section-card">
      <header className="job-requirements-header">
        <div>
          <h2>Screening Criteria</h2>
          <p className="job-requirements-subtitle">
            Pulled from job description ingestion, per-job overrides, or ATS export.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </header>

      {loading && !requirements ? (
        <p className="loading-text">Loading requirements…</p>
      ) : requirements ? (
        <>
          <div className="job-requirements-meta">
            <span className="badge badge-open">{requirements.ingestion_source}</span>
            {requirements.has_override && (
              <span className="job-requirements-override">Per-job override active</span>
            )}
          </div>

          <div className="job-requirements-columns">
            <div>
              <h3 className="section-label">Must-have</h3>
              <ul className="job-requirements-list">
                {requirements.must_have.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="section-label">Nice-to-have</h3>
              <ul className="job-requirements-list">
                {requirements.nice_to_have.length ? (
                  requirements.nice_to_have.map((item) => (
                    <li key={item}>{item}</li>
                  ))
                ) : (
                  <li className="job-requirements-empty">None listed</li>
                )}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="empty-state">Requirements unavailable.</p>
      )}

      <div
        className={`ats-upload-zone ${dragOver ? "ats-upload-zone--active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <p className="ats-upload-title">Import ATS export</p>
        <p className="ats-upload-hint">JSON or CSV with job description and screening criteria.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="ats-upload-input"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importing…" : "Choose file"}
        </button>
      </div>

      {importMessage && <p className="ats-upload-message">{importMessage}</p>}
    </section>
  );
}
