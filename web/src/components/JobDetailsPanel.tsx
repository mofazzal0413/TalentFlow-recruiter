import { useEffect, useState } from "react";
import type { Job } from "../types";
import { JobDescriptionViewer } from "./JobDescriptionViewer";
import "./JobDetailsPanel.css";

interface JobDetailsPanelProps {
  job: Job;
  compact?: boolean;
}

export function JobDetailsPanel({ job, compact = false }: JobDetailsPanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    setExpanded(!compact);
  }, [compact, job.id]);

  if (compact && !expanded) {
    return (
      <section className="job-details-panel job-details-panel--compact section-card">
        <button
          type="button"
          className="job-details-compact-toggle"
          onClick={() => setExpanded(true)}
        >
          <div className="job-details-compact-text">
            <span className="job-details-compact-title">{job.title}</span>
            <span className="job-details-compact-meta">
              {job.department} · {job.location} · {job.level}
            </span>
          </div>
          <span className="job-details-compact-action">Show details</span>
        </button>
      </section>
    );
  }

  return (
    <section className={`job-details-panel section-card ${compact ? "job-details-panel--compact-open" : ""}`}>
      {compact && (
        <button
          type="button"
          className="job-details-collapse"
          onClick={() => setExpanded(false)}
        >
          Collapse
        </button>
      )}
      <header className="job-details-header">
        <h1>{job.title}</h1>
        <span className={`badge ${job.status === "open" ? "badge-open" : "badge-paused"}`}>
          {job.status}
        </span>
      </header>

      <dl className="job-details-grid">
        <div className="job-details-item">
          <dt className="section-label">Role</dt>
          <dd>{job.department}</dd>
        </div>
        <div className="job-details-item">
          <dt className="section-label">Location</dt>
          <dd>{job.location}</dd>
        </div>
        <div className="job-details-item">
          <dt className="section-label">Level</dt>
          <dd>{job.level}</dd>
        </div>
      </dl>

      <JobDescriptionViewer description={job.description} />
    </section>
  );
}
