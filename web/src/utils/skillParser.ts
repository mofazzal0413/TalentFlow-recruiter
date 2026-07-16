export type ResumeSection =
  | "skills"
  | "experience"
  | "education"
  | "projects"
  | "summary"
  | "unknown";

export type ExtractionPass = "first" | "second";

export interface ParsedSection {
  name: ResumeSection;
  heading: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ExtractedSkill {
  name: string;
  canonical: string;
  confidence: number;
  source: ResumeSection;
  pass: ExtractionPass;
  evidence: string;
}

export interface SkillExtractionResult {
  skills: ExtractedSkill[];
  sections: ParsedSection[];
}

interface GenAISkillDefinition {
  canonical: string;
  aliases: string[];
  patterns: RegExp[];
}

const SECTION_HEADERS: Array<{ name: ResumeSection; patterns: RegExp[] }> = [
  {
    name: "skills",
    patterns: [
      /^skills?\b/i,
      /^technical\s+skills?\b/i,
      /^core\s+competenc(?:y|ies)\b/i,
      /^technologies?\b/i,
      /^tools?\s*(?:&|and)\s*technologies?\b/i,
    ],
  },
  {
    name: "experience",
    patterns: [
      /^work\s+experience\b/i,
      /^professional\s+experience\b/i,
      /^experience\b/i,
      /^employment\s+history\b/i,
      /^career\s+history\b/i,
    ],
  },
  {
    name: "education",
    patterns: [
      /^education\b/i,
      /^academic\s+background\b/i,
      /^education\s*&\s*certifications?\b/i,
    ],
  },
  {
    name: "projects",
    patterns: [/^projects?\b/i, /^personal\s+projects?\b/i, /^selected\s+projects?\b/i],
  },
  {
    name: "summary",
    patterns: [/^summary\b/i, /^profile\b/i, /^objective\b/i, /^about\s+me\b/i],
  },
];

const GENAI_SKILL_DEFINITIONS: GenAISkillDefinition[] = [
  {
    canonical: "Hugging Face Transformers",
    aliases: ["huggingface", "hf transformers", "transformers library", "hugging face"],
    patterns: [
      /\bhugging\s*face\b/i,
      /\bhf\s+transformers\b/i,
      /\btransformers\s+(?:library|framework)\b/i,
    ],
  },
  {
    canonical: "LangChain",
    aliases: ["lang chain", "langchain.js", "langchain python"],
    patterns: [/\blang\s*chain\b/i],
  },
  {
    canonical: "LoRA",
    aliases: ["low-rank adaptation", "lora fine-tuning", "lora tuning"],
    patterns: [/\blora\b/i, /\blow[-\s]?rank\s+adaptation\b/i],
  },
  {
    canonical: "RAG",
    aliases: [
      "retrieval-augmented generation",
      "retrieval augmented generation",
      "retrieval augmented",
    ],
    patterns: [
      /\brag\b/i,
      /\bretrieval[-\s]?augmented(?:\s+generation)?\b/i,
    ],
  },
  {
    canonical: "Vector Databases",
    aliases: [
      "vector database",
      "vector db",
      "pinecone",
      "weaviate",
      "chroma",
      "qdrant",
      "milvus",
      "faiss",
      "pgvector",
    ],
    patterns: [
      /\bvector\s+databases?\b/i,
      /\bvector\s+db\b/i,
      /\bpinecone\b/i,
      /\bweaviate\b/i,
      /\bchroma(?:db)?\b/i,
      /\bqdrant\b/i,
      /\bmilvus\b/i,
      /\bfaiss\b/i,
      /\bpgvector\b/i,
    ],
  },
];

const SKILL_DELIMITERS = /[,;|•·\n]|(?:\s+and\s+)/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function detectSectionName(line: string): { name: ResumeSection; inlineContent: string } | null {
  const trimmed = line.trim();
  for (const header of SECTION_HEADERS) {
    for (const pattern of header.patterns) {
      const match = pattern.exec(trimmed);
      if (!match) continue;

      const remainder = normalizeWhitespace(trimmed.slice(match[0].length).replace(/^:/, ""));
      return { name: header.name, inlineContent: remainder };
    }
  }
  return null;
}

/** Split resume text into labeled sections using common heading patterns. */
export function parseSections(rawText: string): ParsedSection[] {
  const lines = rawText.split(/\r?\n/);
  const sections: ParsedSection[] = [];

  let current: ParsedSection | null = null;

  const pushCurrent = () => {
    if (!current) return;
    current.content = current.content.trim();
    sections.push(current);
    current = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const detected = detectSectionName(trimmed);
    if (detected) {
      pushCurrent();
      current = {
        name: detected.name,
        heading: trimmed,
        content: detected.inlineContent,
        startLine: index,
        endLine: index,
      };
      return;
    }

    if (!current) {
      current = {
        name: "unknown",
        heading: "Preamble",
        content: trimmed,
        startLine: index,
        endLine: index,
      };
      return;
    }

    current.content = current.content ? `${current.content}\n${trimmed}` : trimmed;
    current.endLine = index;
  });

  pushCurrent();
  return sections;
}

function splitSkillTokens(sectionText: string): string[] {
  return sectionText
    .split(SKILL_DELIMITERS)
    .map((token) => normalizeWhitespace(token.replace(/^[-•*]\s*/, "")))
    .filter((token) => token.length > 1 && token.length < 80);
}

function findGenAIMatches(text: string): Array<{ definition: GenAISkillDefinition; evidence: string }> {
  const matches: Array<{ definition: GenAISkillDefinition; evidence: string }> = [];

  for (const definition of GENAI_SKILL_DEFINITIONS) {
    for (const pattern of definition.patterns) {
      const match = pattern.exec(text);
      if (match) {
        matches.push({ definition, evidence: match[0] });
        break;
      }
    }
  }

  return matches;
}

function baseConfidence(source: ResumeSection, pass: ExtractionPass): number {
  if (pass === "first") {
    return source === "skills" ? 0.95 : 0.8;
  }

  switch (source) {
    case "experience":
      return 0.72;
    case "projects":
      return 0.78;
    case "summary":
      return 0.68;
    case "skills":
      return 0.9;
    default:
      return 0.58;
  }
}

function upsertSkill(
  map: Map<string, ExtractedSkill>,
  skill: ExtractedSkill,
): void {
  const key = skill.canonical.toLowerCase();
  const existing = map.get(key);
  if (!existing || skill.confidence > existing.confidence) {
    map.set(key, skill);
    return;
  }

  if (skill.confidence === existing.confidence && skill.pass === "second") {
    map.set(key, {
      ...existing,
      confidence: clampConfidence(existing.confidence + 0.05),
      evidence: `${existing.evidence}; ${skill.evidence}`,
    });
  }
}

/** First pass: extract explicit skills from the skills section and known GenAI tokens. */
export function extractSkillsFirstPass(sections: ParsedSection[]): ExtractedSkill[] {
  const found = new Map<string, ExtractedSkill>();

  for (const section of sections) {
    if (section.name !== "skills") continue;

    for (const token of splitSkillTokens(section.content)) {
      const genAiMatches = findGenAIMatches(token);
      if (genAiMatches.length > 0) {
        for (const genAiMatch of genAiMatches) {
          upsertSkill(found, {
            name: genAiMatch.evidence,
            canonical: genAiMatch.definition.canonical,
            confidence: clampConfidence(baseConfidence("skills", "first")),
            source: "skills",
            pass: "first",
            evidence: token,
          });
        }
        continue;
      }

      upsertSkill(found, {
        name: token,
        canonical: token,
        confidence: clampConfidence(baseConfidence("skills", "first") - 0.05),
        source: "skills",
        pass: "first",
        evidence: token,
      });
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Second pass: scan non-skills sections for GenAI skills missed in pass one. */
export function extractGenAISkillsSecondPass(
  sections: ParsedSection[],
  existing: ExtractedSkill[],
): ExtractedSkill[] {
  const found = new Map<string, ExtractedSkill>();
  const known = new Set(existing.map((skill) => skill.canonical.toLowerCase()));

  const scanTargets = sections.filter((section) => section.name !== "skills");

  for (const section of scanTargets) {
    const lines = section.content.split(/\r?\n/).map((line) => normalizeWhitespace(line));

    for (const line of lines) {
      if (!line) continue;

      const genAiMatches = findGenAIMatches(line);
      if (genAiMatches.length === 0) continue;

      for (const genAiMatch of genAiMatches) {
        const key = genAiMatch.definition.canonical.toLowerCase();
        if (known.has(key)) {
          const prior = existing.find((skill) => skill.canonical.toLowerCase() === key);
          if (prior) {
            upsertSkill(found, {
              ...prior,
              confidence: clampConfidence(prior.confidence + 0.05),
              evidence: `${prior.evidence}; ${line}`,
            });
          }
          continue;
        }

        upsertSkill(found, {
          name: genAiMatch.evidence,
          canonical: genAiMatch.definition.canonical,
          confidence: clampConfidence(baseConfidence(section.name, "second")),
          source: section.name,
          pass: "second",
          evidence: line,
        });
        known.add(key);
      }
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

export function mergeExtractedSkills(
  firstPass: ExtractedSkill[],
  secondPass: ExtractedSkill[],
): ExtractedSkill[] {
  const merged = new Map<string, ExtractedSkill>();

  for (const skill of firstPass) {
    upsertSkill(merged, skill);
  }
  for (const skill of secondPass) {
    upsertSkill(merged, skill);
  }

  return [...merged.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Run section-aware parsing with first- and second-pass GenAI skill extraction. */
export function parseSkills(rawText: string): SkillExtractionResult {
  const sections = parseSections(rawText);
  const firstPass = extractSkillsFirstPass(sections);
  const secondPass = extractGenAISkillsSecondPass(sections, firstPass);
  const skills = mergeExtractedSkills(firstPass, secondPass);

  return { skills, sections };
}

export function getGenAISkillDefinitions(): readonly GenAISkillDefinition[] {
  return GENAI_SKILL_DEFINITIONS;
}
