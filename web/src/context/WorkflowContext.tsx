import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import { getNextWorkflowStep } from "../config/workflowStateMachine";
import { logWorkflowTransition } from "../utils/workflowDebugLog";
import { buildRecruiterTasks } from "../utils/recruiterTasks";
import { getRoleProgressStatus } from "../utils/roleProgress";
import { buildExtractionPreview } from "../utils/extractionPreview";
import type {
  AgentOutputSummary,
  Candidate,
  FeedbackEntry,
  FeedbackSubmission,
  Job,
  JobRequirements,
  JobWorkflowSnapshot,
  ResumeData,
  ResumeExtractStatus,
  SchedulingDraft,
  ShortlistItem,
  UncertaintyFlag,
  WorkflowStep,
} from "../types";

interface WorkflowState {
  jobs: Job[];
  jobsLoading: boolean;
  jobsError: string | null;
  jobSnapshots: Record<string, JobWorkflowSnapshot>;
  selectedJob: Job | null;
  selectedJobId: string | null;
  jobRequirements: JobRequirements | null;
  requirementsLoading: boolean;
  requirementsImporting: boolean;
  requirementsImportMessage: string | null;
  currentStep: WorkflowStep;
  candidates: Candidate[];
  candidatesFetched: boolean;
  resumes: Record<string, ResumeData>;
  resumeFlags: Record<string, string[]>;
  resumeStatus: Record<string, ResumeExtractStatus>;
  shortlist: ShortlistItem[];
  borderline: ShortlistItem[];
  uncertaintyFlags: UncertaintyFlag[];
  strongCandidates: ShortlistItem[];
  schedulingDrafts: SchedulingDraft[];
  feedback: FeedbackEntry[];
  checkpointApproved: boolean | null;
  workflowStopped: boolean;
  extractionValidated: boolean;
  loading: boolean;
  error: string | null;
  lastAgentOutput: AgentOutputSummary | null;
  selectJob: (jobId: string) => Promise<void>;
  selectRole: (jobId: string) => Promise<void>;
  startWorkflow: (jobId?: string) => Promise<void>;
  setStep: (step: WorkflowStep) => void;
  goToNextStep: () => void;
  stopWorkflow: () => void;
  fetchCandidates: () => Promise<void>;
  extractResume: (candidateId: string) => Promise<void>;
  extractAllResumes: () => Promise<void>;
  continueToEvaluation: () => Promise<void>;
  confirmExtraction: () => void;
  runEvaluation: () => Promise<void>;
  submitFeedback: (payload: FeedbackSubmission) => Promise<void>;
  approveCheckpoint: (approved: boolean) => Promise<void>;
  clearError: () => void;
  reloadJobs: () => Promise<void>;
  loadRequirements: () => Promise<void>;
  importAtsExport: (file: File) => Promise<void>;
  resetWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowState | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobSnapshots, setJobSnapshots] = useState<Record<string, JobWorkflowSnapshot>>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobRequirements, setJobRequirements] = useState<JobRequirements | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsImporting, setRequirementsImporting] = useState(false);
  const [requirementsImportMessage, setRequirementsImportMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("job-selection");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesFetched, setCandidatesFetched] = useState(false);
  const [resumes, setResumes] = useState<Record<string, ResumeData>>({});
  const [resumeFlags, setResumeFlags] = useState<Record<string, string[]>>({});
  const [resumeStatus, setResumeStatus] = useState<Record<string, ResumeExtractStatus>>({});
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [borderline, setBorderline] = useState<ShortlistItem[]>([]);
  const [uncertaintyFlags, setUncertaintyFlags] = useState<UncertaintyFlag[]>([]);
  const [strongCandidates, setStrongCandidates] = useState<ShortlistItem[]>([]);
  const [schedulingDrafts, setSchedulingDrafts] = useState<SchedulingDraft[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [checkpointApproved, setCheckpointApproved] = useState<boolean | null>(null);
  const [workflowStopped, setWorkflowStopped] = useState(false);
  const [extractionValidated, setExtractionValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAgentOutput, setLastAgentOutput] = useState<AgentOutputSummary | null>(null);

  const recordAgentOutput = useCallback((action: string, summary: string) => {
    setLastAgentOutput({ action, summary, at: new Date().toISOString() });
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const result = await api.getJobs();
      setJobs(result);
    } catch {
      setJobs([]);
      setJobsError(
        "Cannot reach the API. Start the backend with: uvicorn api.main:app --reload --port 8000",
      );
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const previousStepRef = useRef<WorkflowStep | null>(null);
  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    logWorkflowTransition(previousStepRef.current, currentStep, {
      selectedJobId,
      workflowStopped,
    });
    previousStepRef.current = currentStep;
  }, [currentStep, selectedJobId, workflowStopped]);

  useEffect(() => {
    if (!selectedJobId) return;

    const allResumesExtracted =
      candidates.length > 0 &&
      candidates.every((c) => resumeStatus[c.id] === "complete");

    const tasks = buildRecruiterTasks({
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

    const flaggedResumeCount = candidates.filter(
      (c) => (resumeFlags[c.id] ?? []).length > 0,
    ).length;

    setJobSnapshots((prev) => ({
      ...prev,
      [selectedJobId]: {
        currentStep,
        humanTaskCount: tasks.length,
        candidateCount: candidates.length,
        flaggedResumeCount,
        workflowStopped,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [
    selectedJobId,
    currentStep,
    candidates,
    candidatesFetched,
    resumeFlags,
    resumeStatus,
    uncertaintyFlags,
    workflowStopped,
    schedulingDrafts,
  ]);

  const loadRequirements = useCallback(async () => {
    if (!selectedJobId) return;
    setRequirementsLoading(true);
    setError(null);
    try {
      const result = await api.getRequirements(selectedJobId);
      setJobRequirements({
        job_id: result.job_id,
        role: result.role,
        must_have: result.must_have,
        nice_to_have: result.nice_to_have,
        ingestion_source: result.ingestion_source,
        has_override: result.has_override,
      });
      if (result.job) {
        setSelectedJob(result.job);
        setJobs((prev) =>
          prev.map((item) => (item.id === result.job.id ? result.job : item)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requirements.");
      setJobRequirements(null);
    } finally {
      setRequirementsLoading(false);
    }
  }, [selectedJobId]);

  const importAtsExport = useCallback(
    async (file: File) => {
      if (!selectedJobId) return;
      setRequirementsImporting(true);
      setRequirementsImportMessage(null);
      setError(null);
      try {
        const result = await api.importAtsExport(selectedJobId, file);
        setJobRequirements({
          job_id: result.job_id,
          role: result.role,
          must_have: result.must_have,
          nice_to_have: result.nice_to_have,
          ingestion_source: result.ingestion_source,
          has_override: result.has_override,
        });
        if (result.job) {
          setSelectedJob(result.job);
          setJobs((prev) =>
            prev.map((item) => (item.id === result.job.id ? result.job : item)),
          );
        }
        const count = result.import_summary?.criteria_count ?? 0;
        setRequirementsImportMessage(
          `Imported ${file.name}. ${count} screening criteria loaded.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import ATS export.");
      } finally {
        setRequirementsImporting(false);
      }
    },
    [selectedJobId],
  );

  const loadJobDetails = useCallback(
    async (jobId: string) => {
      const cached = jobs.find((job) => job.id === jobId);
      if (cached) {
        setSelectedJob(cached);
      } else {
        try {
          const job = await api.getJob(jobId);
          setSelectedJob(job);
          setJobs((prev) => {
            const exists = prev.some((item) => item.id === job.id);
            return exists ? prev.map((item) => (item.id === job.id ? job : item)) : [...prev, job];
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load job details.");
          setSelectedJob(null);
          throw err;
        }
      }

      setRequirementsLoading(true);
      try {
        const result = await api.getRequirements(jobId);
        setJobRequirements({
          job_id: result.job_id,
          role: result.role,
          must_have: result.must_have,
          nice_to_have: result.nice_to_have,
          ingestion_source: result.ingestion_source,
          has_override: result.has_override,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load requirements.");
        setJobRequirements(null);
      } finally {
        setRequirementsLoading(false);
      }
    },
    [jobs],
  );

  const selectRole = useCallback(
    async (jobId: string) => {
      setSelectedJobId(jobId);
      setError(null);
      await loadJobDetails(jobId);
    },
    [loadJobDetails],
  );

  const startWorkflow = useCallback(
    async (jobId?: string) => {
      const targetId = jobId ?? selectedJobId;
      if (!targetId) return;

      setSelectedJobId(targetId);
      setCandidates([]);
      setCandidatesFetched(false);
      setResumes({});
      setResumeFlags({});
      setResumeStatus({});
      setShortlist([]);
      setBorderline([]);
      setUncertaintyFlags([]);
      setStrongCandidates([]);
      setSchedulingDrafts([]);
      setFeedback([]);
      setCheckpointApproved(null);
      setWorkflowStopped(false);
      setExtractionValidated(false);
      setJobRequirements(null);
      setRequirementsImportMessage(null);
      setError(null);

      await loadJobDetails(targetId);

      const snapshot = jobSnapshots[targetId];
      const status = getRoleProgressStatus(snapshot);
      if (status === "checkpoint-pending") {
        setCurrentStep("checkpoint");
      } else if (status === "in-progress" && snapshot) {
        setCurrentStep(snapshot.currentStep);
      } else {
        setCurrentStep("candidates");
      }
    },
    [selectedJobId, jobSnapshots, loadJobDetails],
  );

  const selectJob = startWorkflow;

  const extractResumeForCandidate = useCallback(async (candidateId: string) => {
    setResumeStatus((prev) => ({ ...prev, [candidateId]: "extracting" }));
    setError(null);
    try {
      const result = await api.extractResume(candidateId);
      setResumes((prev) => ({ ...prev, [candidateId]: result.resume }));
      setResumeFlags((prev) => ({ ...prev, [candidateId]: result.missing_flags }));
      setResumeStatus((prev) => ({ ...prev, [candidateId]: "complete" }));
      recordAgentOutput("extractResume", `Extracted resume for ${candidateId}`);
      return true;
    } catch (err) {
      setResumeStatus((prev) => ({ ...prev, [candidateId]: "error" }));
      setError(err instanceof Error ? err.message : "Failed to extract resume.");
      return false;
    }
  }, [recordAgentOutput]);

  const fetchCandidates = useCallback(async () => {
    if (!selectedJobId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getCandidates(selectedJobId);
      setCandidates(result.candidates);
      setSelectedJob(result.job);
      setCandidatesFetched(true);
      recordAgentOutput(
        "fetchCandidates",
        `Fetched ${result.candidates.length} candidate(s) for ${selectedJobId}`,
      );

      if (result.candidates.length > 0) {
        setCurrentStep("resumes");
        for (const candidate of result.candidates) {
          await extractResumeForCandidate(candidate.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch candidates.");
    } finally {
      setLoading(false);
    }
  }, [extractResumeForCandidate, recordAgentOutput, selectedJobId]);

  const extractResume = useCallback(
    async (candidateId: string) => {
      await extractResumeForCandidate(candidateId);
    },
    [extractResumeForCandidate],
  );

  /**
   * Extraction is only auto-confirmed when every candidate's resume parsed with
   * zero warnings. Anything flagged (low confidence, missing section, etc.) still
   * routes to the human-reviewed Extraction Preview screen — this only shortcuts
   * the clean/happy path, it never bypasses a real flag.
   */
  const allExtractionsClean = useCallback(
    (candidateIds: string[], resumeMap: Record<string, ResumeData>) =>
      candidateIds.length > 0 &&
      candidateIds.every((id) => {
        const resume = resumeMap[id];
        if (!resume) return false;
        return buildExtractionPreview(resume).warnings.length === 0;
      }),
    [],
  );

  const advancePastExtraction = useCallback(
    (candidateIds: string[], resumeMap: Record<string, ResumeData>) => {
      if (allExtractionsClean(candidateIds, resumeMap)) {
        setExtractionValidated(true);
        setCurrentStep("evaluation");
        recordAgentOutput(
          "extractionPreview",
          `${candidateIds.length} resume(s) parsed cleanly with no warnings — AI auto-confirmed, skipping straight to fit evaluation.`,
        );
      } else {
        setExtractionValidated(false);
        setCurrentStep("extraction-preview");
      }
    },
    [allExtractionsClean, recordAgentOutput],
  );

  const continueToEvaluation = useCallback(async () => {
    if (!selectedJobId || !candidates.length) return;
    const allComplete = candidates.every(
      (candidate) => resumeStatus[candidate.id] === "complete" && resumes[candidate.id],
    );
    if (!allComplete) return;

    setLoading(true);
    setError(null);
    try {
      const feedbackResult = await api.getFeedback(selectedJobId);
      setFeedback(feedbackResult.feedback);
      advancePastExtraction(candidates.map((c) => c.id), resumes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue to evaluation.");
    } finally {
      setLoading(false);
    }
  }, [advancePastExtraction, candidates, resumeStatus, resumes, selectedJobId]);

  const extractAllResumes = useCallback(async () => {
    if (!selectedJobId || !candidates.length) return;
    setLoading(true);
    setError(null);
    let allSucceeded = true;

    for (const candidate of candidates) {
      const ok = await extractResumeForCandidate(candidate.id);
      if (!ok) allSucceeded = false;
    }

    if (allSucceeded) {
      try {
        const feedbackResult = await api.getFeedback(selectedJobId);
        setFeedback(feedbackResult.feedback);
        setResumes((latest) => {
          advancePastExtraction(candidates.map((c) => c.id), latest);
          return latest;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feedback.");
        allSucceeded = false;
      }
    }

    setLoading(false);
  }, [advancePastExtraction, candidates, extractResumeForCandidate, selectedJobId]);

  const confirmExtraction = useCallback(() => {
    setExtractionValidated(true);
    setCurrentStep("evaluation");
  }, []);

  const runEvaluation = useCallback(async () => {
    if (!selectedJobId) return;
    if (!extractionValidated) {
      setError("Confirm the Extraction Preview before running fit scoring.");
      setCurrentStep("extraction-preview");
      return;
    }
    setLoading(true);
    setError(null);
    setWorkflowStopped(false);
    setCheckpointApproved(null);
    try {
      const result = await api.evaluate(selectedJobId, candidates, resumes);
      setShortlist(result.shortlist);
      setBorderline(result.borderline_candidates);
      setUncertaintyFlags(result.uncertainty_flags);
      setStrongCandidates(result.strong_candidates);
      recordAgentOutput(
        "runEvaluation",
        `Ranked ${result.shortlist.length} candidate(s), ${result.strong_candidates.length} strong`,
      );
      const feedbackResult = await api.getFeedback(selectedJobId);
      setFeedback(feedbackResult.feedback);
      setCurrentStep("checkpoint");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  }, [recordAgentOutput, selectedJobId, candidates, resumes, extractionValidated]);

  const submitFeedback = useCallback(
    async (payload: FeedbackSubmission) => {
      if (!selectedJobId) return;
      setLoading(true);
      setError(null);
      try {
        await api.submitFeedback(selectedJobId, payload);
        const feedbackResult = await api.getFeedback(selectedJobId);
        setFeedback(feedbackResult.feedback);
        if (shortlist.length > 0) {
          const result = await api.evaluate(selectedJobId, candidates, resumes);
          setShortlist(result.shortlist);
          setBorderline(result.borderline_candidates);
          setUncertaintyFlags(result.uncertainty_flags);
          setStrongCandidates(result.strong_candidates);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit feedback.");
      } finally {
        setLoading(false);
      }
    },
    [selectedJobId, candidates, resumes, shortlist.length],
  );

  const goToNextStep = useCallback(() => {
    const next = getNextWorkflowStep(currentStep);
    if (next) {
      setCurrentStep(next);
    }
  }, [currentStep]);

  const stopWorkflow = useCallback(() => {
    setCheckpointApproved(false);
    setWorkflowStopped(true);
    setCurrentStep("job-selection");
    setCandidates([]);
    setCandidatesFetched(false);
    setResumes({});
    setResumeFlags({});
    setResumeStatus({});
    setShortlist([]);
    setBorderline([]);
    setUncertaintyFlags([]);
    setStrongCandidates([]);
    setSchedulingDrafts([]);
    setFeedback([]);
    setExtractionValidated(false);
    setError(null);
  }, []);

  const approveCheckpoint = useCallback(
    async (approved: boolean) => {
      if (!approved) {
        stopWorkflow();
        return;
      }

      setCheckpointApproved(true);
      setWorkflowStopped(false);
      if (!selectedJobId || !strongCandidates.length) {
        setCurrentStep("scheduling");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await api.schedule(selectedJobId, strongCandidates);
        setSchedulingDrafts(result.drafts);
        recordAgentOutput(
          "schedulingDraft",
          `Generated ${result.drafts.length} scheduling draft(s) — not sent`,
        );
        setCurrentStep("scheduling");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scheduling failed.");
      } finally {
        setLoading(false);
      }
    },
    [recordAgentOutput, selectedJobId, strongCandidates, stopWorkflow],
  );

  const resetWorkflow = useCallback(() => {
    setSelectedJob(null);
    setSelectedJobId(null);
    setJobRequirements(null);
    setRequirementsImportMessage(null);
    setCurrentStep("job-selection");
    setCandidates([]);
    setCandidatesFetched(false);
    setResumes({});
    setResumeFlags({});
    setResumeStatus({});
    setShortlist([]);
    setBorderline([]);
    setUncertaintyFlags([]);
    setStrongCandidates([]);
    setSchedulingDrafts([]);
    setFeedback([]);
    setCheckpointApproved(null);
    setWorkflowStopped(false);
    setExtractionValidated(false);
    setError(null);
    setLastAgentOutput(null);
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      jobsLoading,
      jobsError,
      jobSnapshots,
      selectedJob,
      selectedJobId,
      jobRequirements,
      requirementsLoading,
      requirementsImporting,
      requirementsImportMessage,
      currentStep,
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
      checkpointApproved,
      workflowStopped,
      extractionValidated,
      loading,
      error,
      lastAgentOutput,
      selectJob,
      selectRole,
      startWorkflow,
      setStep: setCurrentStep,
      goToNextStep,
      stopWorkflow,
      fetchCandidates,
      extractResume,
      extractAllResumes,
      continueToEvaluation,
      confirmExtraction,
      runEvaluation,
      submitFeedback,
      approveCheckpoint,
      clearError: () => setError(null),
      reloadJobs: loadJobs,
      loadRequirements,
      importAtsExport,
      resetWorkflow,
    }),
    [
      jobs,
      jobsLoading,
      jobsError,
      jobSnapshots,
      selectedJob,
      selectedJobId,
      jobRequirements,
      requirementsLoading,
      requirementsImporting,
      requirementsImportMessage,
      currentStep,
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
      checkpointApproved,
      workflowStopped,
      extractionValidated,
      loading,
      error,
      lastAgentOutput,
      selectJob,
      selectRole,
      startWorkflow,
      goToNextStep,
      stopWorkflow,
      fetchCandidates,
      extractResume,
      extractAllResumes,
      continueToEvaluation,
      confirmExtraction,
      runEvaluation,
      submitFeedback,
      approveCheckpoint,
      resetWorkflow,
      loadJobs,
      loadRequirements,
      importAtsExport,
    ],
  );

  return (
    <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return context;
}
