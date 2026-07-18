import { NavLink, useNavigate } from "react-router-dom";
import { useWorkflow } from "../context/WorkflowContext";
import type { Job } from "../types";
import {
  getRoleProgressStatus,
  roleProgressActionLabel,
  roleProgressLabel,
  type RoleProgressStatus,
} from "../utils/roleProgress";
import "./Sidebar.css";

function sortByCandidateCount(a: Job, b: Job) {
  return b.candidate_count - a.candidate_count;
}

function candidateCountLabel(count: number) {
  return count === 1 ? "1 candidate" : `${count} candidates`;
}

function JobCard({
  job,
  selectedJobId,
  progressStatus,
  onSelect,
  paused = false,
}: {
  job: Job;
  selectedJobId: string | null;
  progressStatus: RoleProgressStatus;
  onSelect: (jobId: string, paused: boolean) => void;
  paused?: boolean;
}) {
  const isSelected = selectedJobId === job.id;
  const hasCandidates = job.candidate_count > 0;

  return (
    <li>
      <button
        type="button"
        className={[
          "job-card",
          "role-card",
          paused ? "job-card--paused" : "",
          isSelected ? "job-card--selected selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSelect(job.id, paused)}
        aria-current={isSelected ? "true" : undefined}
        aria-label={`${job.title}, ${roleProgressLabel(progressStatus)}`}
      >
        <div className="job-card-top">
          <span className="job-card-title">{job.title}</span>
          <span className={`job-card-progress job-card-progress--${progressStatus}`}>
            {roleProgressLabel(progressStatus)}
          </span>
        </div>
        <span className="job-card-detail">{job.department}</span>
        <span className="job-card-detail">{job.location}</span>
        <div className="job-card-meta">
          <span className="job-card-level">{job.level}</span>
          <span
            className={`job-card-count ${hasCandidates ? "job-card-count--ready" : "job-card-count--empty"}`}
          >
            {candidateCountLabel(job.candidate_count)}
          </span>
        </div>
        {isSelected && <span className="job-card-selected-mark" aria-hidden="true" />}
      </button>
    </li>
  );
}

export function Sidebar() {
  const {
    jobs,
    jobsLoading,
    jobsError,
    jobSnapshots,
    selectedJobId,
    selectRole,
    startWorkflow,
    currentStep,
    reloadJobs,
  } = useWorkflow();
  const navigate = useNavigate();

  const openJobs = jobs.filter((job) => job.status === "open").sort(sortByCandidateCount);
  const otherJobs = jobs.filter((job) => job.status !== "open").sort(sortByCandidateCount);
  const activeJob = jobs.find((job) => job.id === selectedJobId);
  const activeSnapshot = selectedJobId ? jobSnapshots[selectedJobId] : undefined;
  const activeProgress = getRoleProgressStatus(activeSnapshot);
  // A paused/closed role can still have in-flight or checkpoint-pending progress
  // (e.g. started before it was paused) — the button must stay clickable so that
  // progress can be reviewed, not just for roles that are currently "open".
  const canStartWorkflow = Boolean(
    selectedJobId && (activeJob?.status === "open" || activeProgress !== "not-started"),
  );

  function progressForJob(jobId: string): RoleProgressStatus {
    return getRoleProgressStatus(jobSnapshots[jobId]);
  }

  async function handleRoleSelect(jobId: string, paused: boolean) {
    if (paused) {
      await selectRole(jobId);
      return;
    }
    await startWorkflow(jobId);
    navigate("/workflow");
  }

  // The footer button is the one true entry point into a role's workflow — even
  // for a paused/closed role, if it already has progress the action label says
  // "Continue Workflow" / "Review Checkpoint", so clicking it must actually
  // navigate there rather than just re-selecting the role.
  async function handleFooterAction() {
    if (!selectedJobId) return;
    await startWorkflow(selectedJobId);
    navigate("/workflow");
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-brand">
        <h1>TalentFlow</h1>
        <p>Recruiting assistant</p>
      </header>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? "sidebar-nav-link--active" : ""}`
          }
        >
          Agency Dashboard
        </NavLink>
        <NavLink
          to="/workflow"
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? "sidebar-nav-link--active" : ""}`
          }
        >
          Screening Workflow
        </NavLink>
      </nav>

      <nav className="sidebar-jobs" aria-label="Open roles">
        <h2 className="sidebar-heading">Open Roles</h2>

        {jobsLoading ? (
          <p className="sidebar-status">Loading jobs…</p>
        ) : jobsError ? (
          <div className="sidebar-error">
            <p className="sidebar-status">{jobsError}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reloadJobs}>
              Retry
            </button>
          </div>
        ) : openJobs.length === 0 ? (
          <p className="sidebar-status">No open roles found.</p>
        ) : (
          <ul className="job-list">
            {openJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                selectedJobId={selectedJobId}
                progressStatus={progressForJob(job.id)}
                onSelect={handleRoleSelect}
              />
            ))}
          </ul>
        )}

        {!jobsLoading && otherJobs.length > 0 && (
          <>
            <h2 className="sidebar-heading sidebar-heading--secondary">Other Roles</h2>
            <ul className="job-list">
              {otherJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selectedJobId={selectedJobId}
                  progressStatus={progressForJob(job.id)}
                  onSelect={handleRoleSelect}
                  paused
                />
              ))}
            </ul>
          </>
        )}
      </nav>

      <footer className="sidebar-footer">
        {activeJob ? (
          <>
            <p className="sidebar-footer-label">Selected role</p>
            <p className="sidebar-footer-title">{activeJob.title}</p>
            <span className={`job-card-progress job-card-progress--${activeProgress}`}>
              {roleProgressLabel(activeProgress)}
            </span>
            {currentStep !== "job-selection" && selectedJobId === activeJob.id && (
              <p className="sidebar-footer-step">
                Step: <span>{currentStep.replace(/-/g, " ")}</span>
              </p>
            )}
          </>
        ) : (
          <p className="sidebar-footer-hint">Select a role to begin screening.</p>
        )}

        <button
          type="button"
          className="btn btn-primary sidebar-start-btn"
          onClick={() => void handleFooterAction()}
          disabled={!canStartWorkflow}
        >
          {activeJob ? roleProgressActionLabel(activeProgress) : "Start Workflow"}
        </button>
      </footer>
    </aside>
  );
}
