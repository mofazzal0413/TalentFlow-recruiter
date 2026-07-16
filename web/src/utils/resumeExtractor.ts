import type { ResumeData, SkillDetail } from "../types";
import {
  mergeExtractedSkills,
  parseSections,
  parseSkills,
  type ExtractedSkill,
  type ParsedSection,
  type SkillExtractionResult,
} from "./skillParser";

export interface EnhancedResumeData extends ResumeData {
  parsed_sections?: ParsedSection[];
}

function toSkillDetails(skills: ExtractedSkill[]): SkillDetail[] {
  return skills.map((skill) => ({
    name: skill.name,
    canonical: skill.canonical,
    confidence: skill.confidence,
    source: skill.source,
    pass: skill.pass,
    evidence: skill.evidence,
  }));
}

function uniqueSkillNames(skills: ExtractedSkill[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const skill of skills) {
    const label = skill.canonical;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(label);
  }

  return names;
}

function buildRawText(resume: Partial<ResumeData>): string {
  if (resume.raw_text?.trim()) {
    return resume.raw_text;
  }

  const lines: string[] = [];

  if (resume.skills?.length) {
    lines.push("Skills");
    lines.push(resume.skills.join(", "));
  }

  for (const item of resume.experience ?? []) {
    lines.push("Experience");
    lines.push(
      `${item.title} at ${item.company} (${item.years} years) — ${item.summary}`,
    );
  }

  for (const item of resume.education ?? []) {
    lines.push("Education");
    lines.push(`${item.degree}, ${item.school}`);
  }

  return lines.join("\n");
}

/** Extract skills from raw resume text using section-aware two-pass parsing. */
export function extractSkillsFromText(rawText: string): SkillExtractionResult {
  return parseSkills(rawText);
}

/** Merge API-provided skills with section-aware extraction output. */
export function enrichResumeSkills(resume: ResumeData): EnhancedResumeData {
  const rawText = buildRawText(resume);
  const extraction = parseSkills(rawText);
  const baselineSkills = (resume.skills ?? []).map<ExtractedSkill>((name) => ({
    name,
    canonical: name,
    confidence: 0.85,
    source: "skills",
    pass: "first",
    evidence: name,
  }));

  const merged = mergeExtractedSkills(baselineSkills, extraction.skills);
  const sections = parseSections(rawText);

  return {
    ...resume,
    skills: uniqueSkillNames(merged),
    skill_details: toSkillDetails(merged),
    parsed_sections: sections,
  };
}

/** Build a resume object from unstructured text plus optional structured fields. */
export function extractResumeFromText(
  rawText: string,
  existing: Partial<ResumeData> = {},
): EnhancedResumeData {
  const extraction = parseSkills(rawText);
  const sections = parseSections(rawText);

  const experience = existing.experience ?? [];
  const education = existing.education ?? [];

  return {
    skills: uniqueSkillNames(extraction.skills),
    experience,
    education,
    raw_text: rawText,
    source_format: existing.source_format,
    missing_fields: existing.missing_fields,
    error: existing.error,
    suspicious_content: existing.suspicious_content,
    skill_details: toSkillDetails(extraction.skills),
    parsed_sections: sections,
  };
}
