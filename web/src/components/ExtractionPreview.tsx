import { useMemo } from "react";
import type { Candidate, ResumeData } from "../types";
import { buildExtractionPreview, type SectionPreview } from "../utils/extractionPreview";
import "./ExtractionPreview.css";

interface ExtractionPreviewProps {
  candidates: Candidate[];
  resumes: Record<string, ResumeData>;
  loading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

function confidenceTier(confidence: number): "high" | "medium" | "low" | "none" {
  if (confidence === 0) return "none";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function SectionBlock({ section }: { section: SectionPreview }) {
  const tier = confidenceTier(section.confidence);
  return (
    <div className={`extraction-block extraction-block--${tier}`}>
      <div className="extraction-block-top">
        <span className="extraction-block-label">
          {section.label}
          {!section.required && <span className="extraction-block-optional">optional</span>}
        </span>
        <span className={`extraction-block-confidence extraction-block-confidence--${tier}`}>
          {Math.round(section.confidence * 100)}%
        </span>
      </div>
      <div
        className={`extraction-block-bar extraction-block-bar--${tier}`}
        style={{ width: `${Math.round(section.confidence * 100)}%` }}
      />
      <p className="extraction-block-summary">{section.summary}</p>
      {section.warning && <p className="extraction-block-warning">⚠️ {section.warning}</p>}
    </div>
  );
}

function CandidatePreview({ candidate, resume }: { candidate: Candidate; resume?: ResumeData }) {
  const preview = useMemo(
    () => (resume ? buildExtractionPreview(resume) : null),
    [resume],
  );

  if (!preview) {
    return (
      <div className="extraction-candidate extraction-candidate--pending">
        <h3>{candidate.name}</h3>
        <p className="empty-state">Not extracted yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`extraction-candidate ${
        preview.isValid ? "extraction-candidate--valid" : "extraction-candidate--invalid"
      }`}
    >
      <div className="extraction-candidate-header">
        <h3>{candidate.name}</h3>
        <span
          className={`extraction-candidate-status ${
            preview.isValid ? "extraction-candidate-status--valid" : "extraction-candidate-status--invalid"
          }`}
        >
          {preview.isValid ? "Validated" : "Needs review"}
        </span>
      </div>

      <div className="extraction-block-grid">
        {preview.sections.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
      </div>

      {preview.warnings.length > 0 && (
        <ul className="extraction-warning-list">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExtractionPreview({
  candidates,
  resumes,
  loading,
  onConfirm,
  onBack,
}: ExtractionPreviewProps) {
  const previews = useMemo(
    () =>
      candidates.map((candidate) => ({
        candidate,
        preview: resumes[candidate.id] ? buildExtractionPreview(resumes[candidate.id]) : null,
      })),
    [candidates, resumes],
  );

  const invalidCount = previews.filter(({ preview }) => preview && !preview.isValid).length;
  const allChecked = previews.every(({ preview }) => preview !== null);

  return (
    <section id="extraction-preview-panel" className="extraction-preview workflow-step-panel screen">
      <header className="page-header">
        <h1>Extraction Preview</h1>
        <p>
          Review each resume broken into Header, Skills, Experience, Projects, and Education
          blocks with a confidence score. Fix or re-extract anything flagged before scoring runs.
        </p>
      </header>

      <div className="section-card extraction-preview-card">
        <div className="extraction-preview-summary">
          <span>{candidates.length} candidate{candidates.length === 1 ? "" : "s"}</span>
          <span className={invalidCount > 0 ? "extraction-preview-summary--warning" : ""}>
            {invalidCount} need{invalidCount === 1 ? "s" : ""} review
          </span>
        </div>

        {candidates.length === 0 ? (
          <p className="empty-state">No candidates loaded.</p>
        ) : (
          <div className="extraction-candidate-list">
            {previews.map(({ candidate }) => (
              <CandidatePreview
                key={candidate.id}
                candidate={candidate}
                resume={resumes[candidate.id]}
              />
            ))}
          </div>
        )}

        <div className="extraction-preview-actions actions-row">
          <button type="button" className="btn btn-secondary" onClick={onBack} disabled={loading}>
            Back to Resume Extraction
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading || !allChecked || candidates.length === 0}
            title={
              invalidCount > 0
                ? "Some resumes are flagged for review — you can still confirm if you've checked them manually"
                : undefined
            }
          >
            {invalidCount > 0
              ? "Confirm Anyway & Continue to Scoring"
              : "Confirm Extraction & Continue to Scoring"}
          </button>
        </div>

        <p className="extraction-preview-note">
          AI cannot proceed to fit scoring until extraction is confirmed here.
        </p>
      </div>
    </section>
  );
}
