import { AgentStatusBar } from "../components/AgentStatusBar";
import { CandidateTable } from "../components/CandidateTable";
import { CheckpointScreen } from "../components/CheckpointScreen";
import { ClientPackButton } from "../components/ClientPackButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { JobDetailsPanel } from "../components/JobDetailsPanel";
import { JobRequirementsPanel } from "../components/JobRequirementsPanel";
import { RecruiterTaskQueue } from "../components/RecruiterTaskQueue";
import { ResumeViewer } from "../components/ResumeViewer";
import { SchedulingDraftScreen } from "../components/SchedulingDraftScreen";
import { ShortlistPanel } from "../components/ShortlistPanel";
import { Sidebar } from "../components/Sidebar";
import { WorkflowStopped } from "../components/WorkflowStopped";
import { WorkflowWelcome } from "../components/WorkflowWelcome";
import { WorkflowDebugPanel } from "../components/WorkflowDebugPanel";
import { WorkflowTimeline } from "../components/WorkflowTimeline";
import { useWorkflow } from "../context/WorkflowContext";
import { buildRecruiterTasks } from "../utils/recruiterTasks";
import type { WorkflowStep } from "../types";
import "./WorkflowPage.css";

export function WorkflowPage() {
  const {
    jobs,
    selectedJob,
    selectedJobId,
    currentStep,
    jobsLoading,
    jobsError,
    candidates,
    candidatesFetched,
    resumes,
    resumeFlags,
    resumeStatus,
    shortlist,
    borderline,
    uncertaintyFlags,
    strongCandidates,
    schedulingDrafts,
    feedback,
    workflowStopped,
    checkpointApproved,
    loading,
    error,
    lastAgentOutput,
    fetchCandidates,
    extractResume,
    extractAllResumes,
    continueToEvaluation,
    runEvaluation,
    submitFeedback,
    approveCheckpoint,
    clearError,
    resetWorkflow,
    setStep,
    reloadJobs,
    jobRequirements,
    requirementsLoading,
    requirementsImporting,
    requirementsImportMessage,
    loadRequirements,
    importAtsExport,
  } = useWorkflow();

  function retryCurrentStep() {
    clearError();
    if (currentStep === "candidates") fetchCandidates();
    else if (currentStep === "resumes") extractAllResumes();
    else if (currentStep === "evaluation") runEvaluation();
  }

  const extractedCount = candidates.filter(
    (candidate) => resumeStatus[candidate.id] === "complete",
  ).length;
  const allResumesExtracted =
    candidates.length > 0 && extractedCount === candidates.length;
  const anyExtracting = candidates.some(
    (candidate) => resumeStatus[candidate.id] === "extracting",
  );

  const recruiterTasks = buildRecruiterTasks({
    candidates,
    candidatesFetched,
    resumeFlags,
    resumeStatus,
    uncertaintyFlags,
    currentStep,
    workflowStopped,
    schedulingDrafts,
    allResumesExtracted,
  });

  function goTo(step: WorkflowStep) {
    if (step === "job-selection" && selectedJobId) return;
    setStep(step);
  }

  const openRoleCount = jobs.filter((job) => job.status === "open").length;

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-panel">
        <AgentStatusBar currentStep={currentStep} onStepClick={goTo} />

        <WorkflowDebugPanel
          currentStep={currentStep}
          selectedJobId={selectedJobId}
          selectedJobTitle={selectedJob?.title ?? null}
          workflowStopped={workflowStopped}
          checkpointApproved={checkpointApproved}
          candidatesCount={candidates.length}
          shortlistCount={shortlist.length}
          lastAgentOutput={lastAgentOutput}
          error={error}
          jobsError={jobsError}
        />

        <main className="main-content">
          <div
            key={selectedJobId ? `${selectedJobId}-${currentStep}` : "welcome"}
            className="workflow-screen screen"
          >
          {jobsError && !jobsLoading && (
            <ErrorBanner message={jobsError} onRetry={reloadJobs} />
          )}

          {error && (
            <ErrorBanner
              message={error}
              onRetry={retryCurrentStep}
              onDismiss={clearError}
            />
          )}

          {!selectedJobId && <WorkflowWelcome openRoleCount={openRoleCount} />}

          {selectedJobId && !selectedJob && (
            <div className="section-card job-details-loading">
              <p className="loading-text">Loading job details…</p>
            </div>
          )}

          {selectedJob && (
            <JobDetailsPanel
              key={selectedJob.id}
              job={selectedJob}
              compact={currentStep !== "candidates" && currentStep !== "resumes"}
            />
          )}

          {selectedJob && (
            <JobRequirementsPanel
              requirements={jobRequirements}
              loading={requirementsLoading}
              importing={requirementsImporting}
              importMessage={requirementsImportMessage}
              onImport={importAtsExport}
              onRefresh={loadRequirements}
            />
          )}

          {selectedJob && (
            <WorkflowTimeline
              selectedJob={selectedJob}
              currentStep={currentStep}
              candidatesFetched={candidatesFetched}
              candidatesCount={candidates.length}
              extractedCount={extractedCount}
              allResumesExtracted={allResumesExtracted}
              anyExtracting={anyExtracting}
              shortlistCount={shortlist.length}
              checkpointApproved={checkpointApproved}
              workflowStopped={workflowStopped}
              schedulingDraftsCount={schedulingDrafts.length}
              onNavigate={goTo}
            />
          )}

          {selectedJob && (
            <RecruiterTaskQueue tasks={recruiterTasks} onNavigate={goTo} />
          )}

          {selectedJob && currentStep === "job-selection" && !workflowStopped && (
            <section key="job-selection" className="workflow-step-panel screen">
              <header className="page-header">
                <h1>Job selected</h1>
                <p>
                  Role ready: <strong>{selectedJob.title}</strong>. Continue to fetch candidates
                  from the ATS.
                </p>
              </header>
              <div className="section-card">
                <p className="empty-state">
                  Click <strong>Start Workflow</strong> in the sidebar or continue below.
                </p>
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep("candidates")}
                  >
                    Continue to Fetch Candidates
                  </button>
                </div>
              </div>
            </section>
          )}

          {selectedJob && currentStep === "candidates" && (
            <section key="candidates" className="workflow-step-panel screen">
              <header className="page-header">
                <h1>Fetch Candidates</h1>
                <p>Pull applicants from the ATS. AI will automatically extract resumes next.</p>
              </header>
              <div className="section-card">
                <h2>ATS Candidates</h2>
                {loading ? (
                  <p className="loading-text">Fetching candidates…</p>
                ) : candidates.length > 0 ? (
                  <CandidateTable candidates={candidates} />
                ) : candidatesFetched ? (
                  <div className="empty-state-card">
                    <p className="empty-state-title">No applicants yet for this role</p>
                    <p className="empty-state">
                      The ATS returned zero candidates. Try a role with applicants in the
                      sidebar, or check back when new applications arrive.
                    </p>
                  </div>
                ) : (
                  <p className="empty-state">
                    Click <strong>Fetch Candidates</strong> to load applicants from the ATS.
                  </p>
                )}
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={fetchCandidates}
                    disabled={loading}
                  >
                    {loading ? "Fetching & extracting…" : "Fetch Candidates"}
                  </button>
                  {candidatesFetched && candidates.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStep("resumes")}
                    >
                      Continue to Resume Extraction
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {selectedJob && currentStep === "resumes" && (
            <section key="resumes" className="workflow-step-panel screen">
              <header className="page-header">
                <h1>Resume Extraction</h1>
                <p>Extract and review resume content for each candidate.</p>
              </header>
              <div className="section-card">
                <h2>Extracted Resumes</h2>
                {candidates.length === 0 ? (
                  <p className="empty-state">No candidates loaded. Fetch candidates first.</p>
                ) : (
                  <>
                    <p className="resume-progress">
                      <strong>
                        {extractedCount} of {candidates.length}
                      </strong>{" "}
                      resumes extracted
                    </p>
                    {candidates.map((candidate, index) => (
                      <ResumeViewer
                        key={candidate.id}
                        candidateName={candidate.name}
                        status={resumeStatus[candidate.id] ?? "idle"}
                        resume={resumes[candidate.id]}
                        missingFlags={resumeFlags[candidate.id] ?? []}
                        onExtract={() => extractResume(candidate.id)}
                        extracting={loading || anyExtracting}
                        animationIndex={index}
                      />
                    ))}
                  </>
                )}
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={extractAllResumes}
                    disabled={loading || anyExtracting || !candidates.length}
                  >
                    {anyExtracting ? "Extracting…" : "Extract All"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={continueToEvaluation}
                    disabled={loading || anyExtracting || !allResumesExtracted}
                  >
                    Continue to Fit Evaluation
                  </button>
                </div>
              </div>
            </section>
          )}

          {selectedJob && currentStep === "evaluation" && (
            <section key="evaluation" className="workflow-step-panel screen">
              <header className="page-header">
                <h1>Fit Evaluation</h1>
                <p>Review ranked candidates, scores, and uncertainty flags.</p>
              </header>
              <ClientPackButton
                job={selectedJob}
                shortlist={shortlist}
                borderline={borderline}
                uncertaintyFlags={uncertaintyFlags}
                feedback={feedback}
              />
              {shortlist.length > 0 ? (
                <ShortlistPanel
                  shortlist={shortlist}
                  uncertaintyFlags={uncertaintyFlags}
                  borderline={borderline}
                />
              ) : (
                <div className="section-card">
                  <h2>Evaluation</h2>
                  <p className="empty-state">Run evaluation to generate the ranked shortlist.</p>
                </div>
              )}
              <FeedbackPanel
                candidates={candidates}
                feedback={feedback}
                loading={loading}
                onSubmit={submitFeedback}
              />
              <div className="actions-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runEvaluation}
                  disabled={loading || !Object.keys(resumes).length}
                >
                  {loading ? "Evaluating…" : "Run Evaluation"}
                </button>
                {shortlist.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep("checkpoint")}
                  >
                    Continue to Checkpoint
                  </button>
                )}
              </div>
            </section>
          )}

          {selectedJob && currentStep === "checkpoint" && !workflowStopped && (
            <CheckpointScreen
              shortlist={shortlist}
              uncertaintyFlags={uncertaintyFlags}
              strongCount={strongCandidates.length}
              loading={loading}
              onApprove={() => approveCheckpoint(true)}
              onStop={() => approveCheckpoint(false)}
            />
          )}

          {selectedJob && currentStep === "checkpoint" && !workflowStopped && shortlist.length > 0 && (
            <>
              <ClientPackButton
                job={selectedJob}
                shortlist={shortlist}
                borderline={borderline}
                uncertaintyFlags={uncertaintyFlags}
                feedback={feedback}
              />
              <FeedbackPanel
                candidates={candidates}
                feedback={feedback}
                loading={loading}
                onSubmit={submitFeedback}
              />
            </>
          )}

          {selectedJob && currentStep === "checkpoint" && !workflowStopped && shortlist.length === 0 && (
            <section key="checkpoint-empty" className="workflow-step-panel screen">
              <header className="page-header">
                <h1>Checkpoint</h1>
                <p>Run evaluation to generate a shortlist before approval.</p>
              </header>
              <div className="section-card">
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={runEvaluation}
                    disabled={loading || !Object.keys(resumes).length}
                  >
                    {loading ? "Evaluating…" : "Run Evaluation"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {selectedJob && workflowStopped && (
            <WorkflowStopped
              shortlist={shortlist}
              borderline={borderline}
              uncertaintyFlags={uncertaintyFlags}
              onRerunEvaluation={runEvaluation}
              onStartOver={resetWorkflow}
            />
          )}

          {selectedJob && currentStep === "scheduling" && !workflowStopped && (
            <SchedulingDraftScreen drafts={schedulingDrafts} onFinish={resetWorkflow} />
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
