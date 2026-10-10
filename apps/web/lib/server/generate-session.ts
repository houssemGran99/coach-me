import "server-only";
import { randomUUID } from "node:crypto";
import {
  buildFallbackSession, errorMessage, filterEligible, resolveSessionPlan,
  type ErrorCode, type Practice, type SessionRequest, type TrainingSession,
} from "@mourabbi/schemas";
import prompts from "../generated/prompts.json";
import { LlmUnavailableError, type Llm } from "../llm/types";
import type { MockSessionContext } from "../llm/mock";
import { generationQuota } from "./limits";
import { loadPool } from "./pool";
import { escapeForPrompt, isOutOfScope } from "./scope";
import type { Store } from "./store/types";

export type SessionRequestWithInclude = SessionRequest & { includePracticeId?: string };

export type GenerateResult =
  | { ok: true; session: TrainingSession; source: "llm" | "fallback"; retries: number }
  | { ok: false; code: ErrorCode | "RATE_LIMITED"; message: string; status: number };

export interface Deps {
  llm: Llm;
  store: Store;
  now?: () => Date;
  newId?: () => string;
}

const SYSTEM = (prompts as Record<string, string>)["generate-session"]!;

const brief = (p: Practice) => ({
  id: p.id,
  kind: p.kind,
  name: p.name.en,
  themes: p.themes,
  players: [p.minPlayers, p.maxPlayers],
  area: [p.area.lengthM, p.area.widthM],
  equipment: p.equipment,
});

export function buildSessionPrompt(request: SessionRequestWithInclude, allowed: Practice[], rejected?: { answer: unknown; errors: string[] }): string {
  const { meta, focus } = request;
  const parts = [
    `<squad>${JSON.stringify({
      ageGroup: meta.ageGroup,
      players: meta.playerCount,
      availableMinutes: meta.availableMinutes,
      space: meta.space,
      equipment: meta.equipment,
      language: meta.language,
      focusTheme: focus.theme,
    })}</squad>`,
    `<coach_note>${escapeForPrompt(focus.sourceNote)}</coach_note>`,
  ];
  if (request.includePracticeId) parts.push(`<must_include>${escapeForPrompt(request.includePracticeId)}</must_include>`);
  parts.push(`<allowed_practices>${JSON.stringify(allowed.map(brief))}</allowed_practices>`);
  if (rejected) {
    const prev = typeof rejected.answer === "string" ? rejected.answer.slice(0, 1500) : JSON.stringify(rejected.answer).slice(0, 1500);
    parts.push(
      `Your previous answer was rejected.\n<previous_answer>${escapeForPrompt(prev)}</previous_answer>\nProblems:\n${rejected.errors.map((e) => `- ${e}`).join("\n")}\nFix every problem and return the corrected JSON object only.`,
    );
  } else {
    parts.push("Return the JSON object now.");
  }
  return parts.join("\n");
}

/**
 * Generate a session: filter practices server-side, ask the model for ids and timings,
 * validate, retry once with the errors, then fall back to a pattern built in code.
 */
export async function generateSession(deps: Deps, owner: string, request: SessionRequestWithInclude): Promise<GenerateResult> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;
  const lang = request.meta.language;
  const fail = (code: ErrorCode | "RATE_LIMITED", message: string, status: number): GenerateResult => ({ ok: false, code, message, status });

  if (isOutOfScope(request.focus.sourceNote)) {
    return fail("OUT_OF_SCOPE", errorMessage("OUT_OF_SCOPE", lang), 422);
  }
  const quota = await generationQuota(deps.store, owner, now());
  if (!quota.allowed) return fail("RATE_LIMITED", "", 429);

  const pool = await loadPool(deps.store, owner);
  const eligible = filterEligible(pool.all, request.meta);
  const pin = request.includePracticeId ? eligible.find((p) => p.id === request.includePracticeId) : undefined;
  // A pinned practice that does not fit the squad is simply not requested.
  const req: SessionRequestWithInclude = { ...request, includePracticeId: pin?.id };

  const hasWarm = eligible.some((p) => p.kind === "warmup");
  const hasCool = eligible.some((p) => p.kind === "cooldown");
  const hasSkill = eligible.some((p) => p.kind === "technical" || p.kind === "main" || p.kind === "game_related");
  if (!hasWarm || !hasCool || !hasSkill) {
    const message = errorMessage("NO_SUITABLE_DRILLS", lang);
    await deps.store.logGeneration({ owner, kind: "session", input: logInput(req), output: { error: "NO_SUITABLE_DRILLS", prefilter: true }, valid: false, retries: 0 });
    return fail("NO_SUITABLE_DRILLS", message, 422);
  }

  const ctx = { id: newId(), now: now().toISOString() };
  const context: MockSessionContext = { request: { meta: request.meta, focus: request.focus }, practices: eligible, includePracticeId: req.includePracticeId };
  const outputs: unknown[] = [];
  let rejected: { answer: unknown; errors: string[] } | undefined;
  let retries = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    let answer: unknown;
    try {
      answer = await deps.llm.completeJson({ task: "session", system: SYSTEM, user: buildSessionPrompt(req, eligible, rejected), maxTokens: 1500, context });
    } catch (e) {
      if (!(e instanceof LlmUnavailableError)) throw e;
      outputs.push({ unavailable: e.message });
      rejected = { answer: "", errors: ["The service was unavailable."] };
      retries = attempt;
      continue;
    }
    outputs.push(answer);
    const r = resolveSessionPlan(answer, { meta: request.meta, focus: request.focus }, (id) => eligible.find((p) => p.id === id), ctx);
    if (r.status === "error") {
      await deps.store.logGeneration({ owner, kind: "session", input: logInput(req), output: outputs, valid: true, retries: attempt });
      return fail(r.error.code, r.error.message, 422);
    }
    if (r.status === "ok") {
      if (req.includePracticeId && !r.session.phases.some((p) => p.practiceId === req.includePracticeId)) {
        rejected = { answer, errors: [`The session must include the practice "${req.includePracticeId}".`] };
        retries = attempt + 1;
        continue;
      }
      await persist(deps.store, owner, r.session);
      await deps.store.logGeneration({ owner, kind: "session", input: logInput(req), output: outputs, valid: true, retries: attempt });
      return { ok: true, session: r.session, source: "llm", retries: attempt };
    }
    rejected = { answer, errors: r.errors };
    retries = attempt + 1;
  }

  const fb = buildFallbackSession({ meta: request.meta, focus: request.focus }, eligible, ctx, { pin });
  await deps.store.logGeneration({ owner, kind: "session", input: logInput(req), output: outputs, valid: false, retries: 1 });
  if (fb.status === "error") return fail(fb.error.code, fb.error.message, 422);
  await persist(deps.store, owner, fb.session);
  return { ok: true, session: fb.session, source: "fallback", retries };
}

async function persist(store: Store, owner: string, session: TrainingSession) {
  await store.upsertSession({ id: session.id, owner, data: session, reflection: null });
}

/** What we keep in the log: the structured request, never anything more. */
function logInput(req: SessionRequestWithInclude) {
  return { meta: req.meta, focus: req.focus, includePracticeId: req.includePracticeId ?? null };
}
