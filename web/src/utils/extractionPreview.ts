import type { ResumeData } from "../types";
import { parseSections, type ParsedSection } from "./skillParser";

export type PreviewSectionKey = "header" | "skills" | "experience" | "projects" | "education";

export interface SectionPreview {
  key: PreviewSectionKey;
  label: string;
  detected: boolean;
  confidence: number;
  required: boolean;
  summary: string;
  warning?: string;
}

export interface ExtractionPreviewResult {
  sections: SectionPreview[];
  warnings: string[];
  isValid: boolean;
}

const LABELS: Record<PreviewSectionKey, string> = {
  header: "Header",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
};

/** Only these blocks gate scoring — Header/Projects are informational, not required. */
const REQUIRED_SECTIONS: PreviewSectionKey[] = ["skills", "experience", "education"];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function countTokens(text: string): number {
  return text
    .split(/[,;|•\n]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1).length;
}

function findParsedSection(sections: ParsedSection[], name: ParsedSection["name"]): string {
  return sections
    .filter((section) => section.name === name)
    .map((section) => section.content)
    .filter(Boolean)
    .join("\n");
}

function headerContent(sections: ParsedSection[], rawText: string): string {
  const first = sections[0];
  if (first && first.name === "unknown") {
    return [first.heading === "Preamble" ? "" : first.heading, first.content]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  const firstLine = rawText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  return firstLine.trim();
}

function previewHeader(sections: ParsedSection[], rawText: string): SectionPreview {
  const content = headerContent(sections, rawText);
  const looksLikeSectionBody = /^(skills?|experience|education|projects?)\s*:/i.test(content);
  const detected = content.length > 0 && !looksLikeSectionBody;
  const confidence = detected ? clamp01(content.length > 15 ? 0.85 : 0.5) : 0;

  return {
    key: "header",
    label: LABELS.header,
    detected,
    confidence,
    required: false,
    summary: detected ? content.slice(0, 120) : "No header/contact line detected",
  };
}

function previewSkills(resume: ResumeData, sections: ParsedSection[]): SectionPreview {
  const structuredCount = resume.skills?.length ?? 0;
  const parsedTokenCount = countTokens(findParsedSection(sections, "skills"));
  const count = Math.max(structuredCount, parsedTokenCount);

  let confidence = 0;
  if (count >= 6) confidence = 0.92;
  else if (count >= 3) confidence = 0.75;
  else if (count >= 1) confidence = 0.5;

  const detected = count > 0;
  const warning = !detected
    ? `${LABELS.skills} section not detected.`
    : confidence < 0.6
      ? `${LABELS.skills} section low confidence.`
      : undefined;

  return {
    key: "skills",
    label: LABELS.skills,
    detected,
    confidence: clamp01(confidence),
    required: true,
    summary: detected ? `${count} skill${count === 1 ? "" : "s"} found` : "No skills detected",
    warning,
  };
}

function previewExperience(resume: ResumeData): SectionPreview {
  const entries = resume.experience ?? [];
  const count = entries.length;
  const complete = entries.filter(
    (item) => item.title && item.company && item.summary && item.years > 0,
  ).length;

  let confidence = 0;
  if (count > 0) {
    confidence = 0.5 + 0.15 * Math.min(count, 3);
    if (complete < count) confidence -= 0.12;
  }

  const detected = count > 0;
  const warning = !detected
    ? `${LABELS.experience} section not detected.`
    : confidence < 0.6
      ? `${LABELS.experience} section low confidence.`
      : undefined;

  return {
    key: "experience",
    label: LABELS.experience,
    detected,
    confidence: clamp01(confidence),
    required: true,
    summary: detected ? `${count} entr${count === 1 ? "y" : "ies"} found` : "No experience detected",
    warning,
  };
}

function previewEducation(resume: ResumeData): SectionPreview {
  const entries = resume.education ?? [];
  const count = entries.length;
  const complete = entries.filter((item) => item.degree && item.school).length;

  const detected = count > 0;
  const confidence = detected ? (complete === count ? 0.85 : 0.55) : 0;
  const warning = !detected
    ? `${LABELS.education} section not detected.`
    : confidence < 0.6
      ? `${LABELS.education} section low confidence.`
      : undefined;

  return {
    key: "education",
    label: LABELS.education,
    detected,
    confidence: clamp01(confidence),
    required: true,
    summary: detected ? `${count} entr${count === 1 ? "y" : "ies"} found` : "No education detected",
    warning,
  };
}

function previewProjects(sections: ParsedSection[]): SectionPreview {
  const content = findParsedSection(sections, "projects");
  const detected = content.trim().length > 0;
  const confidence = detected ? clamp01(content.length > 40 ? 0.78 : 0.55) : 0;

  return {
    key: "projects",
    label: LABELS.projects,
    detected,
    confidence,
    required: false,
    summary: detected ? "Projects section found" : "No projects section (optional)",
  };
}

/**
 * Build the extraction_preview step output: one block per resume section with a
 * confidence score, plus warnings for anything missing or malformed. This runs
 * after extraction and before skill parsing/scoring so a human can catch a bad
 * parse before it silently skews the fit score.
 */
export function buildExtractionPreview(resume: ResumeData): ExtractionPreviewResult {
  const rawText = resume.raw_text ?? "";
  const sections = resume.raw_text ? parseSections(resume.raw_text) : [];

  const previewSections: SectionPreview[] = [
    previewHeader(sections, rawText),
    previewSkills(resume, sections),
    previewExperience(resume),
    previewEducation(resume),
    previewProjects(sections),
  ];

  const warnings = previewSections
    .map((section) => section.warning)
    .filter((warning): warning is string => Boolean(warning));

  const requiredDetected = previewSections.filter(
    (section) => REQUIRED_SECTIONS.includes(section.key) && section.detected,
  ).length;

  if (requiredDetected === 0) {
    warnings.push("Resume format unclear.");
  }

  const isValid = REQUIRED_SECTIONS.every((key) =>
    previewSections.find((section) => section.key === key)?.detected,
  );

  return { sections: previewSections, warnings, isValid };
}
