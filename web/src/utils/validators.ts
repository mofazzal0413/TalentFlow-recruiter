import type { ResumeData, SchedulingDraft, ShortlistItem } from "../types";

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: string[];
}

export interface CalendarSlots {
  proposed_slots: string[];
  timezone?: string;
  panel?: string[];
  free_blocks?: Array<{ start: string; end: string }>;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /schedule\s+me\s+immediately/i,
  /you\s+are\s+now\s+in\s+scheduling\s+mode/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Generic field-presence check (Step 7 spec). */
export function validate(requiredFields: string[], data: unknown): boolean {
  if (!data) return false;
  if (Array.isArray(data)) {
    return data.every((entry) => validate(requiredFields, entry));
  }
  if (!isRecord(data)) return false;
  return requiredFields.every((field) => data[field] !== undefined);
}

/** Loose shortlist shape check — maps score → match_score, flags → uncertainty_flags. */
export function validateShortlistLoose(data: unknown): boolean {
  if (!Array.isArray(data)) return false;
  return data.every((entry) => {
    if (!isRecord(entry)) return false;
    const score = entry.score ?? entry.match_score;
    const flags = entry.flags ?? entry.uncertainty_flags;
    return (
      typeof entry.name === "string" &&
      typeof score === "number" &&
      (flags === undefined || Array.isArray(flags))
    );
  });
}

/** Loose resume shape check — flags maps to missing_fields when present. */
export function validateResumeLoose(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const flags = data.flags ?? data.missing_fields;
  return (
    Array.isArray(data.skills) &&
    Array.isArray(data.experience) &&
    (flags === undefined || Array.isArray(flags))
  );
}

/** Calendar slots — accepts proposed_slots or slots key. */
export function validateCalendarSlotsLoose(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const slots = data.slots ?? data.proposed_slots;
  return Array.isArray(slots);
}

/** Draft email — accepts string body or { subject, body } object. */
export function validateDraftEmailLoose(data: unknown): boolean {
  if (typeof data === "string") return data.trim().length > 0;
  if (!isRecord(data)) return false;
  return typeof data.subject === "string" && typeof data.body === "string";
}

export interface FitEvaluationPayload {
  shortlist: ShortlistItem[];
  borderline_candidates: ShortlistItem[];
  strong_candidates: ShortlistItem[];
  uncertainty_flags: unknown[];
}

export function validateFitEvaluation(data: unknown): ValidationResult<FitEvaluationPayload> {
  if (!isRecord(data)) {
    return { ok: false, errors: ["Fit evaluation response must be an object."] };
  }

  const shortlistResult = validateShortlist(data.shortlist);
  const borderlineResult = validateShortlist(data.borderline_candidates ?? []);
  const strongResult = validateShortlist(data.strong_candidates ?? []);
  const errors = [
    ...shortlistResult.errors.map((e) => `shortlist: ${e}`),
    ...borderlineResult.errors.map((e) => `borderline: ${e}`),
    ...strongResult.errors.map((e) => `strong: ${e}`),
  ];

  if (!Array.isArray(data.uncertainty_flags)) {
    errors.push("uncertainty_flags must be an array.");
  }

  if (errors.length > 0 || !shortlistResult.data) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      shortlist: shortlistResult.data,
      borderline_candidates: borderlineResult.data ?? [],
      strong_candidates: strongResult.data ?? [],
      uncertainty_flags: data.uncertainty_flags as unknown[],
    },
    errors: [],
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function hasInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateShortlist(data: unknown): ValidationResult<ShortlistItem[]> {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return { ok: false, errors: ["Shortlist must be an array."] };
  }

  const items: ShortlistItem[] = [];

  data.forEach((entry, index) => {
    const prefix = `Shortlist item ${index + 1}`;
    const itemErrors: string[] = [];

    if (!isRecord(entry)) {
      errors.push(`${prefix}: must be an object.`);
      return;
    }

    if (!isString(entry.candidate_id) || !entry.candidate_id.trim()) {
      itemErrors.push(`${prefix}: candidate_id must be a non-empty string.`);
    }
    if (!isString(entry.name) || !entry.name.trim()) {
      itemErrors.push(`${prefix}: name must be a non-empty string.`);
    }
    if (!isNumber(entry.rank) || entry.rank < 1) {
      itemErrors.push(`${prefix}: rank must be a positive number.`);
    }
    if (!isNumber(entry.match_score) || entry.match_score < 0 || entry.match_score > 100) {
      itemErrors.push(`${prefix}: match_score must be between 0 and 100.`);
    }
    if (!isBoolean(entry.meets_bar)) {
      itemErrors.push(`${prefix}: meets_bar must be a boolean.`);
    }
    if (!isString(entry.reason)) {
      itemErrors.push(`${prefix}: reason must be a string.`);
    }
    if (!isStringArray(entry.uncertainty_flags)) {
      itemErrors.push(`${prefix}: uncertainty_flags must be an array of strings.`);
    }
    if (
      entry.mismatch_flags !== undefined &&
      !isStringArray(entry.mismatch_flags)
    ) {
      itemErrors.push(`${prefix}: mismatch_flags must be an array of strings.`);
    }

    if (isString(entry.reason) && hasInjection(entry.reason)) {
      itemErrors.push(`${prefix}: reason contains suspicious agent instruction text.`);
    }

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
      return;
    }

    items.push({
      candidate_id: String(entry.candidate_id),
      name: String(entry.name),
      rank: Number(entry.rank),
      match_score: Number(entry.match_score),
      meets_bar: Boolean(entry.meets_bar),
      reason: String(entry.reason),
      uncertainty_flags: entry.uncertainty_flags as string[],
      mismatch_flags: entry.mismatch_flags as string[] | undefined,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: items, errors: [] };
}

export function validateResume(data: unknown): ValidationResult<ResumeData> {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { ok: false, errors: ["Resume must be an object."] };
  }

  if (!isStringArray(data.skills)) {
    errors.push("skills must be an array of strings.");
  }

  if (!Array.isArray(data.experience)) {
    errors.push("experience must be an array.");
  } else {
    data.experience.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`experience[${index}] must be an object.`);
        return;
      }
      if (!isString(item.title)) errors.push(`experience[${index}].title must be a string.`);
      if (!isString(item.company)) errors.push(`experience[${index}].company must be a string.`);
      if (!isNumber(item.years) || item.years < 0) {
        errors.push(`experience[${index}].years must be a non-negative number.`);
      }
      if (!isString(item.summary)) errors.push(`experience[${index}].summary must be a string.`);
    });
  }

  if (!Array.isArray(data.education)) {
    errors.push("education must be an array.");
  } else {
    data.education.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`education[${index}] must be an object.`);
        return;
      }
      if (!isString(item.degree)) errors.push(`education[${index}].degree must be a string.`);
      if (!isString(item.school)) errors.push(`education[${index}].school must be a string.`);
    });
  }

  if (data.raw_text !== undefined && !isString(data.raw_text)) {
    errors.push("raw_text must be a string when provided.");
  }
  if (data.source_format !== undefined && !isString(data.source_format)) {
    errors.push("source_format must be a string when provided.");
  }
  if (data.missing_fields !== undefined && !isStringArray(data.missing_fields)) {
    errors.push("missing_fields must be an array of strings when provided.");
  }
  if (data.error !== undefined && !isString(data.error)) {
    errors.push("error must be a string when provided.");
  }
  if (data.suspicious_content !== undefined && !isBoolean(data.suspicious_content)) {
    errors.push("suspicious_content must be a boolean when provided.");
  }

  if (isString(data.raw_text) && hasInjection(data.raw_text)) {
    // Flagged via suspicious_content in backend; raw text may contain adversarial content for review.
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      skills: data.skills as string[],
      experience: data.experience as ResumeData["experience"],
      education: data.education as ResumeData["education"],
      raw_text: data.raw_text as string | undefined,
      source_format: data.source_format as string | undefined,
      missing_fields: data.missing_fields as string[] | undefined,
      error: data.error as string | undefined,
      suspicious_content: data.suspicious_content as boolean | undefined,
    },
    errors: [],
  };
}

export function validateCalendarSlots(data: unknown): ValidationResult<CalendarSlots> {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { ok: false, errors: ["Calendar slots must be an object."] };
  }

  if (!isStringArray(data.proposed_slots)) {
    errors.push("proposed_slots must be an array of strings.");
  } else if (data.proposed_slots.length === 0) {
    errors.push("proposed_slots must contain at least one slot.");
  } else if (data.proposed_slots.some((slot) => !slot.trim())) {
    errors.push("proposed_slots cannot include empty values.");
  }

  if (data.timezone !== undefined && !isString(data.timezone)) {
    errors.push("timezone must be a string when provided.");
  }

  if (data.panel !== undefined && !isStringArray(data.panel)) {
    errors.push("panel must be an array of strings when provided.");
  }

  if (data.free_blocks !== undefined) {
    if (!Array.isArray(data.free_blocks)) {
      errors.push("free_blocks must be an array when provided.");
    } else {
      data.free_blocks.forEach((block, index) => {
        if (!isRecord(block) || !isString(block.start) || !isString(block.end)) {
          errors.push(`free_blocks[${index}] must include start and end strings.`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      proposed_slots: data.proposed_slots as string[],
      timezone: data.timezone as string | undefined,
      panel: data.panel as string[] | undefined,
      free_blocks: data.free_blocks as CalendarSlots["free_blocks"],
    },
    errors: [],
  };
}

export function validateDraftEmail(data: unknown): ValidationResult<string> {
  const errors: string[] = [];

  if (!isString(data)) {
    return { ok: false, errors: ["Draft email must be a string."] };
  }

  const text = data.trim();
  if (!text) {
    errors.push("Draft email cannot be empty.");
  }
  if (text.length > 8000) {
    errors.push("Draft email exceeds maximum allowed length.");
  }
  if (!text.includes("To:")) {
    errors.push('Draft email must include a "To:" line.');
  }
  if (!/\[DRAFT\s*[—-]\s*NOT SENT\]/i.test(text)) {
    errors.push("Draft email must include the [DRAFT — NOT SENT] safety marker.");
  }
  if (hasInjection(text)) {
    errors.push("Draft email contains suspicious agent instruction text.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data, errors: [] };
}

/** Agent scheduling payload shape (Step 9 spec). */
export function validateSchedulingAgentOutput(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const slots = data.slots ?? data.proposed_slots;
  const email = data.email ?? data.draft_email ?? data.body;
  const slotsValid = Array.isArray(slots)
    ? slots.every((slot) => {
        if (typeof slot === "string") return slot.trim().length > 0;
        if (!isRecord(slot)) return false;
        return typeof slot.date === "string" && typeof slot.time === "string";
      })
    : validateCalendarSlotsLoose({ slots, proposed_slots: slots });
  const emailValid =
    typeof email === "string"
      ? validateDraftEmailLoose(email)
      : validateDraftEmailLoose(data);
  return slotsValid && emailValid;
}

export function validateSchedulingDrafts(
  data: unknown,
): ValidationResult<SchedulingDraft[]> {
  if (!Array.isArray(data)) {
    return { ok: false, errors: ["Scheduling drafts must be an array."] };
  }

  const errors: string[] = [];
  const drafts: SchedulingDraft[] = [];

  data.forEach((entry, index) => {
    const prefix = `Draft ${index + 1}`;
    if (!isRecord(entry)) {
      errors.push(`${prefix}: must be an object.`);
      return;
    }

    const slotsResult = validateCalendarSlots({ proposed_slots: entry.proposed_slots });
    const emailResult = validateDraftEmail(entry.draft_email);

    if (!isString(entry.candidate_id) || !entry.candidate_id.trim()) {
      errors.push(`${prefix}: candidate_id must be a non-empty string.`);
    }
    if (!isString(entry.name) || !entry.name.trim()) {
      errors.push(`${prefix}: name must be a non-empty string.`);
    }
    if (!isString(entry.email) || !entry.email.includes("@")) {
      errors.push(`${prefix}: email must be a valid-looking address.`);
    }
    if (!slotsResult.ok) {
      errors.push(...slotsResult.errors.map((error) => `${prefix}: ${error}`));
    }
    if (!emailResult.ok) {
      errors.push(...emailResult.errors.map((error) => `${prefix}: ${error}`));
    }

    if (
      isString(entry.candidate_id) &&
      isString(entry.name) &&
      isString(entry.email) &&
      slotsResult.ok &&
      emailResult.ok
    ) {
      drafts.push({
        candidate_id: entry.candidate_id,
        name: entry.name,
        email: entry.email,
        proposed_slots: slotsResult.data!.proposed_slots,
        draft_email: emailResult.data!,
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: drafts, errors: [] };
}

export function assertValid<T>(result: ValidationResult<T>, label: string): T {
  if (!result.ok || result.data === undefined) {
    throw new Error(`${label}: ${result.errors.join(" ")}`);
  }
  return result.data;
}
