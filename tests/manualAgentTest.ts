/**
 * Manual agent workflow test.
 *
 * Run (API must be up on port 8000):
 *   npx tsx tests/manualAgentTest.ts
 *
 * Optional:
 *   API_BASE=http://127.0.0.1:8000/api npx tsx tests/manualAgentTest.ts
 */

import { enrichResumeSkills } from "../web/src/utils/resumeExtractor";

const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:8000/api";

const GENAI_CANONICAL = [
  "Hugging Face Transformers",
  "LangChain",
  "LoRA",
  "RAG",
  "Vector Databases",
] as const;

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function record(name: string, passed: boolean, detail: string): void {
  results.push({ name, passed, detail });
  const icon = passed ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}`);
  console.log(`       ${detail}\n`);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body);
    throw new Error(`${response.status} ${path}: ${detail}`);
  }

  return body as T;
}

async function requestExpectStatus(
  path: string,
  expectedStatus: number,
  options?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

async function testHealth(): Promise<void> {
  const health = await request<{ status: string }>("/health");
  record("API health", health.status === "ok", `status=${health.status}`);
}

async function testGoldenWorkflow(): Promise<void> {
  const jobId = "job_001";
  const { candidates } = await request<{ candidates: Array<{ id: string; name: string }> }>(
    `/jobs/${jobId}/candidates`,
    { method: "POST" },
  );

  const resumes: Record<string, unknown> = {};
  for (const candidate of candidates) {
    const extracted = await request<{ resume: Record<string, unknown> }>(
      `/candidates/${candidate.id}/resume`,
      { method: "POST" },
    );
    resumes[candidate.id] = enrichResumeSkills(
      extracted.resume as Parameters<typeof enrichResumeSkills>[0],
    );
  }

  const evaluation = await request<{
    shortlist: Array<{ name: string; rank: number; match_score: number }>;
    strong_candidates: Array<{ name: string }>;
  }>(`/jobs/${jobId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ candidates, resumes }),
  });

  const top = evaluation.shortlist.find((item) => item.rank === 1);
  const janeFirst = top?.name === "Jane Doe";
  record(
    "Golden shortlist ranks Jane Doe #1",
    janeFirst,
    top ? `${top.name} at rank ${top.rank} (${top.match_score}%)` : "No rank-1 candidate",
  );

  const blocked = await requestExpectStatus(`/jobs/${jobId}/scheduling`, 403, {
    method: "POST",
    body: JSON.stringify({
      strong_candidates: evaluation.strong_candidates,
      checkpoint_approved: false,
    }),
  });
  record(
    "Checkpoint blocks scheduling without approval",
    blocked.status === 403,
    String(blocked.body.detail ?? blocked.status),
  );

  const scheduling = await request<{ drafts: Array<{ name: string; draft_email: string }> }>(
    `/jobs/${jobId}/scheduling`,
    {
      method: "POST",
      body: JSON.stringify({
        strong_candidates: evaluation.strong_candidates,
        checkpoint_approved: true,
      }),
    },
  );

  const draft = scheduling.drafts[0];
  const draftOk =
    Boolean(draft) &&
    draft.name === "Jane Doe" &&
    draft.draft_email.includes("[DRAFT — NOT SENT]");
  record(
    "Scheduling draft after checkpoint approval",
    draftOk,
    draft ? `${draft.name} draft generated` : "No draft returned",
  );
}

async function testAdversarialResume(): Promise<void> {
  const extracted = await request<{
    resume: { suspicious_content?: boolean; raw_text?: string };
    missing_flags: string[];
  }>("/candidates/cand_004/resume", { method: "POST" });

  const flagged =
    extracted.resume.suspicious_content === true ||
    extracted.missing_flags.some((flag) => flag.toLowerCase().includes("suspicious"));
  record(
    "Adversarial resume flagged as suspicious",
    flagged,
    `suspicious_content=${extracted.resume.suspicious_content}`,
  );

  const raw = extracted.resume.raw_text?.toLowerCase() ?? "";
  const injectionPresent = raw.includes("ignore") && raw.includes("schedule me immediately");
  record(
    "Adversarial injection present in raw text (for human review)",
    injectionPresent,
    injectionPresent ? "Injection text detected in raw_text" : "No injection markers found",
  );
}

async function testGenAISkillExtraction(): Promise<void> {
  const extracted = await request<{ resume: Parameters<typeof enrichResumeSkills>[0] }>(
    "/candidates/cand_021/resume",
    { method: "POST" },
  );

  const enriched = enrichResumeSkills(extracted.resume);
  const genAiFound = GENAI_CANONICAL.filter((skill) =>
    enriched.skill_details?.some((detail) => detail.canonical === skill),
  );
  const secondPass = enriched.skill_details?.filter((detail) => detail.pass === "second") ?? [];

  const pass =
    genAiFound.length >= 3 &&
    genAiFound.includes("LangChain") &&
    genAiFound.includes("RAG");

  record(
    "GenAI skill extraction for Sofia Alvarez (cand_021)",
    pass,
    `found=${genAiFound.join(", ") || "none"}; second_pass=${secondPass.length}`,
  );

  if (enriched.skill_details?.length) {
    console.log("       Skill confidence breakdown:");
    for (const skill of enriched.skill_details) {
      const pct = Math.round(skill.confidence * 100);
      console.log(
        `       - ${skill.canonical}: ${pct}% (${skill.source}, ${skill.pass} pass)`,
      );
    }
    console.log("");
  }
}

async function testGenAIJobPipeline(): Promise<void> {
  const jobId = "job_012";
  const { candidates, job } = await request<{
    job: { title: string };
    candidates: Array<{ id: string; name: string }>;
  }>(`/jobs/${jobId}/candidates`, { method: "POST" });

  const requirements = await request<{ must_have: string[]; nice_to_have: string[] }>(
    `/jobs/${jobId}/requirements`,
  );

  const resumes: Record<string, ReturnType<typeof enrichResumeSkills>> = {};
  for (const candidate of candidates) {
    const extracted = await request<{ resume: Parameters<typeof enrichResumeSkills>[0] }>(
      `/candidates/${candidate.id}/resume`,
      { method: "POST" },
    );
    resumes[candidate.id] = enrichResumeSkills(extracted.resume);
  }

  const evaluation = await request<{
    shortlist: Array<{ name: string; rank: number; match_score: number }>;
  }>(`/jobs/${jobId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ candidates, resumes }),
  });

  const sofia = evaluation.shortlist.find((item) => item.name === "Sofia Alvarez");
  const ranked = Boolean(sofia);
  record(
    "GenAI job evaluation returns ranked shortlist",
    ranked,
    `${job.title}: ${evaluation.shortlist.length} ranked; must_have=${requirements.must_have.join(", ")}`,
  );

  if (sofia) {
    record(
      "Sofia Alvarez scored on GenAI Engineer role",
      sofia.match_score > 0,
      `rank=${sofia.rank}, score=${sofia.match_score}%`,
    );
  }
}

async function main(): Promise<void> {
  console.log("TalentFlow manual agent test");
  console.log(`API: ${API_BASE}\n`);

  try {
    await testHealth();
    await testGoldenWorkflow();
    await testAdversarialResume();
    await testGenAISkillExtraction();
    await testGenAIJobPipeline();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record("Manual agent test execution", false, message);
    console.error(
      "\nMake sure the API is running:\n  .venv/bin/python -m uvicorn api.main:app --reload --port 8000\n",
    );
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log("─".repeat(48));
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
