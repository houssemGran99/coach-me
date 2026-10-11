import "server-only";
import { nanoid } from "nanoid";
import {
  LlmErrorSchema, PracticeSchema, TemplateAdaptationSchema, areaFits, errorMessage,
  type ErrorCode, type Lang, type Practice, type TemplateAdaptation,
} from "@mourabbi/schemas";
import { animationExtent, validateSpec } from "@mourabbi/animation";
import prompts from "../generated/prompts.json";
import { LlmUnavailableError, type Llm } from "../llm/types";
import { parseConstraints, detectLanguage, rankTemplates, type Constraints, type Ranked } from "../practice-search";
import { getTemplates } from "../templates";
import { getConfig } from "./config";
import { generationQuota } from "./limits";
import { escapeForPrompt, isOutOfScope } from "./scope";
import type { Store } from "./store/types";

export const MAX_MESSAGE = 600;
const SYSTEM = (prompts as Record<string, string>)["generate-practice"]!;

export type PracticeKind = "template_adapted" | "new_draft" | "closest_template" | "refined";

export type PracticeEvent =
  | { type: "stage"; stage: "check" | "parse" | "search" | "write" | "validate" }
  | { type: "result"; kind: PracticeKind; practice: Practice; /** Template this came from, if any. */ templateId: string | null }
  | { type: "error"; code: ErrorCode | "RATE_LIMITED" | "REFINE_FAILED" | "LLM_UNAVAILABLE" | "SERVER"; message: string };

export interface PracticeDeps {
  llm: Llm;
  store: Store;
  now?: () => Date;
  templates?: Practice[];
}

export interface PracticeInput {
  message: string;
  uiLang: Lang;
  /** The draft being refined ("make it 6v6"). */
  previous?: Practice | null;
}

const strip = (p: Practice) => ({
  id: p.id, ageGroups: p.ageGroups, minPlayers: p.minPlayers, maxPlayers: p.maxPlayers, area: p.area, equipment: p.equipment,
  themes: p.themes, name: p.name, organisation: p.organisation, coachingPoints: p.coachingPoints, variants: p.variants,
});

export function buildPracticePrompt(args: {
  mode: "template" | "freeform" | "refine";
  lang: Lang;
  message: string;
  constraints: Constraints;
  template?: Practice;
  inspiration?: Practice[];
  previous?: Practice | null;
  rejected?: { answer: unknown; errors: string[] };
}): string {
  const parts = [
    `<mode>${args.mode}</mode>`,
    `<request_language>${args.lang}</request_language>`,
    `<constraints>${JSON.stringify(args.constraints)}</constraints>`,
    `<coach_request>${escapeForPrompt(args.message)}</coach_request>`,
  ];
  if (args.template) parts.push(`<template>${JSON.stringify(strip(args.template))}</template>`);
  if (args.inspiration?.length) parts.push(`<templates>${JSON.stringify(args.inspiration)}</templates>`);
  if (args.previous) parts.push(`<previous_practice>${escapeForPrompt(JSON.stringify(args.previous))}</previous_practice>`);
  if (args.rejected) {
    const prev = typeof args.rejected.answer === "string" ? args.rejected.answer : JSON.stringify(args.rejected.answer);
    parts.push(
      `Your previous answer was rejected.\n<previous_answer>${escapeForPrompt(prev.slice(0, 2500))}</previous_answer>\nProblems:\n${args.rejected.errors.map((e) => `- ${e}`).join("\n")}\nFix every problem and return the corrected JSON object only.`,
    );
  } else parts.push("Return the JSON object now.");
  return parts.join("\n");
}

const AI_REVIEW = { status: "ai_draft", reviewedBy: null, reviewedAt: null } as const;
const newId = () => `draft_${nanoid(10).replace(/[^A-Za-z0-9_-]/g, "x")}`;

/** Mode A: the model's text on top of the template's own animation. Returns errors instead of a practice when invalid. */
export function assembleAdaptation(tpl: Practice, a: TemplateAdaptation): { practice?: Practice; errors: string[] } {
  if (a.templateId !== tpl.id) return { errors: [`templateId must be "${tpl.id}".`] };
  let area = tpl.area;
  if (a.area) {
    const ext = animationExtent(tpl.animation);
    const ok =
      a.area.lengthM >= Math.max(8, ext.lengthM) && a.area.widthM >= Math.max(8, ext.widthM) &&
      a.area.lengthM <= tpl.area.lengthM && a.area.widthM <= tpl.area.widthM;
    if (ok) area = a.area; // otherwise the adjustment is outside the template's own bounds and is ignored
  }
  const candidate = {
    ...tpl,
    id: newId(),
    area,
    name: a.name,
    organisation: a.organisation,
    coachingPoints: a.coachingPoints,
    variants: a.variants,
    source: "ai" as const,
    review: { ...AI_REVIEW },
    animation: tpl.animation,
  };
  const parsed = PracticeSchema.safeParse(candidate);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const issues = validateSpec(parsed.data.animation, parsed.data.area);
  return issues.length ? { errors: issues.map((i) => i.message) } : { practice: parsed.data, errors: [] };
}

/** Does a freeform practice respect what the coach asked for? */
export function fitErrors(p: Practice, c: Constraints): string[] {
  const out: string[] = [];
  if (c.age && !p.ageGroups.includes(c.age)) out.push(`ageGroups must include ${c.age}.`);
  if (c.players !== undefined && (c.players < p.minPlayers || c.players > p.maxPlayers)) {
    out.push(`minPlayers..maxPlayers (${p.minPlayers}..${p.maxPlayers}) must include ${c.players} players.`);
  }
  if (c.area && !areaFits(p.area, c.area)) out.push(`area ${p.area.lengthM}x${p.area.widthM} m must fit in ${c.area.lengthM}x${c.area.widthM} m.`);
  return out;
}

/** Mode B and refinement: validate a full practice the model wrote. */
export function checkFreeform(raw: Practice | unknown, c: Constraints): { practice?: Practice; errors: string[] } {
  const base = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // The server, not the model, decides the trust fields and the id.
  const candidate = { ...base, id: newId(), source: "ai", review: { ...AI_REVIEW } };
  const parsed = PracticeSchema.safeParse(candidate);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  const errors = [
    ...validateSpec(parsed.data.animation, parsed.data.area).map((i) => `animation ${i.path}: ${i.message}`),
    ...fitErrors(parsed.data, c),
  ];
  return errors.length ? { errors } : { practice: parsed.data, errors: [] };
}

export function pickTemplates(templates: Practice[]): Practice[] {
  const cfg = getConfig();
  return templates.filter((t) => cfg.allowPendingTemplates || t.review.status === "reviewed");
}

/**
 * The practice chat pipeline: scope check -> parse -> search the templates -> Mode A (adapt a template)
 * or Mode B (write a new one) -> validate -> retry once -> closest template. Yields progress events.
 */
export async function* generatePractice(deps: PracticeDeps, owner: string, input: PracticeInput): AsyncGenerator<PracticeEvent> {
  const now = deps.now ?? (() => new Date());
  const lang = detectLanguage(input.message, input.uiLang);
  const refining = !!input.previous;

  yield { type: "stage", stage: "check" };
  if (isOutOfScope(input.message)) {
    yield { type: "error", code: "OUT_OF_SCOPE", message: errorMessage("OUT_OF_SCOPE", lang) };
    return;
  }
  const quota = await generationQuota(deps.store, owner, now());
  if (!quota.allowed) {
    yield { type: "error", code: "RATE_LIMITED", message: "" };
    return;
  }

  yield { type: "stage", stage: "parse" };
  const constraints = parseConstraints(input.message);

  yield { type: "stage", stage: "search" };
  const templates = pickTemplates(deps.templates ?? getTemplates());
  const ranked: Ranked[] = rankTemplates(templates, constraints, input.message);
  const best = !refining && ranked[0]?.fits ? ranked[0].practice : undefined;
  const mode = refining ? "refine" : best ? "template" : "freeform";
  const closest = ranked[0]?.practice;

  yield { type: "stage", stage: "write" };
  const outputs: unknown[] = [];
  let rejected: { answer: unknown; errors: string[] } | undefined;
  let retries = 0;
  let result: PracticeEvent | null = null;
  let modelError: PracticeEvent | null = null;

  for (let attempt = 0; attempt < 2 && !result && !modelError; attempt++) {
    const user = buildPracticePrompt({
      mode, lang, message: input.message, constraints, template: best,
      inspiration: mode === "freeform" ? ranked.slice(0, 2).map((r) => r.practice) : undefined,
      previous: input.previous, rejected,
    });
    let answer: unknown;
    try {
      answer = await deps.llm.completeJson({
        task: "practice", system: SYSTEM, user, maxTokens: 8000,
        context: { mode, template: best, inspiration: ranked.slice(0, 2).map((r) => r.practice), previous: input.previous, constraints, message: input.message, lang },
      });
    } catch (e) {
      if (!(e instanceof LlmUnavailableError)) throw e;
      outputs.push({ unavailable: e.message });
      rejected = { answer: "", errors: ["The service was unavailable."] };
      retries = attempt + 1;
      continue;
    }
    outputs.push(answer);

    yield { type: "stage", stage: "validate" };
    const obj = (answer && typeof answer === "object" ? answer : {}) as { mode?: string; practice?: unknown; error?: unknown };

    if (obj.error) {
      const e = LlmErrorSchema.safeParse(obj);
      if (e.success) {
        modelError = { type: "error", code: e.data.error.code, message: e.data.error.message };
        break;
      }
    }

    if (obj.mode === "template") {
      const t = TemplateAdaptationSchema.safeParse(obj);
      if (!best) {
        rejected = { answer, errors: [`mode must be "${mode}".`] };
      } else if (!t.success) {
        rejected = { answer, errors: t.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
      } else {
        const asm = assembleAdaptation(best, t.data);
        if (asm.practice) result = { type: "result", kind: "template_adapted", practice: asm.practice, templateId: best.id };
        else rejected = { answer, errors: asm.errors };
      }
    } else if (obj.mode === "freeform") {
      if (best) {
        rejected = { answer, errors: [`mode must be "template" and templateId "${best.id}".`] };
      } else {
        const f = checkFreeform(obj.practice, constraints);
        if (f.practice) result = { type: "result", kind: refining ? "refined" : "new_draft", practice: f.practice, templateId: null };
        else rejected = { answer, errors: f.errors };
      }
    } else {
      rejected = { answer, errors: ['Return one JSON object with "mode": "template" or "freeform", or an "error" object.'] };
    }
    if (!result) retries = attempt + 1;
  }

  const valid = !!result || !!modelError;
  await deps.store.logGeneration({
    owner, kind: "practice", valid, retries: result ? Math.min(retries, 1) : 1,
    input: { message: input.message, mode, constraints, language: lang, refining },
    output: outputs,
  });

  if (modelError) {
    yield modelError;
    return;
  }
  if (result) {
    yield result;
    return;
  }
  if (refining) {
    yield { type: "error", code: "REFINE_FAILED", message: "" };
    return;
  }
  // Two failures: hand back the closest template, unchanged, and say so.
  if (closest) {
    yield { type: "result", kind: "closest_template", practice: closest, templateId: closest.id };
    return;
  }
  yield { type: "error", code: "NO_SUITABLE_DRILLS", message: errorMessage("NO_SUITABLE_DRILLS", lang) };
}
