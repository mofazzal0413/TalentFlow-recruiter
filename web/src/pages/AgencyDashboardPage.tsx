import { Link } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { useWorkflow } from "../context/WorkflowContext";
import { WORKFLOW_STEPS } from "../types";
import "./AgencyDashboard.css";

function stepLabel(stepId: string): string {
  return WORKFLOW_STEPS.find((s) => s.id === stepId)?.label ?? "Not started";
}

export function AgencyDashboardPage() {
  const { jobs, jobsLoading, jobsError, jobSnapshots, selectedJobId, selectJob, reloadJobs } =
    useWorkflow();

  const inProgress = Object.values(jobSnapshots).filter(
    (s) => s.currentStep !== "job-selection" && !s.workflowStopped,
  ).length;
  const humanTasks = Object.values(jobSnapshots).reduce(
    (sum, s) => sum + s.humanTaskCount,
    0,
  );
  const flaggedResumes = Object.values(jobSnapshots).reduce(
    (sum, s) => sum + s.flaggedResumeCount,
    0,
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-panel">
        <main className="main-content main-content--wide agency-dashboard">
          <header className="page-header">
            <h1>Agency Dashboard</h1>
            <p>All roles, pipeline progress, and human tasks across your recruiting desk.</p>
          </header>

          <div className="dashboard-stats">
            <div className="dashboard-stat">
              <span className="dashboard-stat-value">{jobs.length}</span>
              <span className="dashboard-stat-label">Total roles</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-value">{inProgress}</span>
              <span className="dashboard-stat-label">In progress</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-value">{humanTasks}</span>
              <span className="dashboard-stat-label">Human tasks</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-value">{flaggedResumes}</span>
              <span className="dashboard-stat-label">Flagged resumes</span>
            </div>
            <div className="dashboard-stat dashboard-stat--ai">
              <span className="dashboard-stat-value">67%</span>
              <span className="dashboard-stat-label">AI workflow</span>
            </div>
          </div>

          <div className="section-card">
            <h2>Role pipeline</h2>

            {jobsLoading ? (
              <p className="loading-text">Loading roles…</p>
            ) : jobsError ? (
              <div className="dashboard-error">
                <p>{jobsError}</p>
                <button type="button" className="btn btn-secondary" onClick={reloadJobs}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Dept</th>
                      <th>Candidates</th>
                      <th>Status</th>
                      <th>Pipeline step</th>
                      <th>Human tasks</th>
                      <th>Flags</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const snapshot = jobSnapshots[job.id];
                      const isActive = selectedJobId === job.id;

                      return (
                        <tr key={job.id} className={isActive ? "dashboard-row--active" : ""}>
                          <td>
                            <strong>{job.title}</strong>
                            <span className="dashboard-location">{job.location}</span>
                          </td>
                          <td>{job.department}</td>
                          <td>{job.candidate_count}</td>
                          <td>
                            <span
                              className={`badge ${job.status === "open" ? "badge-open" : "badge-paused"}`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td>{snapshot ? stepLabel(snapshot.currentStep) : "Not started"}</td>
                          <td>
                            {snapshot && snapshot.humanTaskCount > 0 ? (
                              <span className="dashboard-task-count">{snapshot.humanTaskCount}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {snapshot && snapshot.flaggedResumeCount > 0 ? (
                              <span className="dashboard-flag-count">{snapshot.flaggedResumeCount}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <Link
                              to="/workflow"
                              className="btn btn-secondary btn-sm"
                              onClick={() => selectJob(job.id)}
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
