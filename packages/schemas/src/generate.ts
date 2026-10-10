import { describeProblems, hasProblem, runSessionChecks, type PracticeLookup } from "./checks";
import { rankByTheme } from "./eligibility";
import type { Practice } from "./practice";
import {
  LlmErrorSchema, LlmSessionPlanSchema, TrainingSessionSchema,
  type LlmError, type SessionRequest, type TrainingSession,
} from "./session";

export interface BuildContext {
  id: string;
  now: string;
}

export type PlanResolution =
  | { status: "ok"; session: TrainingSession }
  | { status: "error"; error: LlmError["error"] }
  | { status: "invalid"; errors: string[] };

/**
 * Turn the raw model output into a TrainingSession and validate it.
 * Rules: strict parse, durations sum to the stated total and fit the time,
 * ids exist and are allowed, players/area/equipment fit, warm-up first, cool-down last.
 */
export function resolveSessionPlan(
  raw: unknown,
  request: SessionRequest,
  lookup: PracticeLookup,
  ctx: BuildContext,
): PlanResolution {
  const asError = LlmErrorSchema.safeParse(raw);
  if (asError.success) return { status: "error", error: asError.data.error };

  const plan = LlmSessionPlanSchema.safeParse(raw);
  if (!plan.success) {
    return { status: "invalid", errors: plan.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }

  const unknownIds = plan.data.phases.filter((p) => !lookup(p.practiceId)).map((p) => p.practiceId);
  if (unknownIds.length) {
    return { status: "invalid", errors: unknownIds.map((id) => `practiceId "${id}" is not in the allowed list.`) };
  }

  const candidate = {
    id: ctx.id,
    createdAt: ctx.now,
    meta: request.meta,
    focus: request.focus,
    phases: plan.data.phases.map((p, i) => ({
      order: i + 1,
      practiceId: p.practiceId,
      kind: lookup(p.practiceId)!.kind,
      durationMinutes: p.durationMinutes,
    })),
    totalDurationMinutes: plan.data.totalDurationMinutes,
    source: "llm" as const,
  };

  const parsed = TrainingSessionSchema.safeParse(candidate);
  if (!parsed.success) {
    return { status: "invalid", errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }

  const checks = runSessionChecks(parsed.data, lookup);
  if (hasProblem(checks)) return { status: "invalid", errors: describeProblems(checks, lookup) };
  return { status: "ok", session: parsed.data };
}

export type FallbackResult =
  | { status: "ok"; session: TrainingSession }
  | { status: "error"; error: { code: "NO_SUITABLE_DRILLS" | "CONSTRAINTS_CONFLICT"; message: string } };

const FALLBACK_MESSAGES = {
  NO_SUITABLE_DRILLS: {
    en: "No drill fits these constraints yet. Try another age group, more players, a bigger space or more equipment.",
    fr: "Aucun exercice ne convient à ces contraintes pour l'instant. Essayez une autre catégorie, plus de joueurs, un espace plus grand ou plus de matériel.",
    ar: "لا يوجد تمرين يناسب هذه الشروط حاليًا. جرّب فئة عمرية أخرى أو عددًا أكبر من اللاعبين أو مساحة أكبر أو معدات أكثر.",
  },
  CONSTRAINTS_CONFLICT: {
    en: "The time is too short to fit a warm-up, the drills and a cool-down.",
    fr: "Le temps est trop court pour un échauffement, les exercices et un retour au calme.",
    ar: "الوقت أقصر من أن يتسع للإحماء والتمارين والتهدئة.",
  },
} as const;

export function errorMessage(code: keyof typeof FALLBACK_MESSAGES, lang: "fr" | "ar" | "en"): string {
  return FALLBACK_MESSAGES[code][lang];
}

/** Split `budget` minutes across `n` phases, each 3..45, as evenly as possible (extra minutes go to later phases). */
export function splitMinutes(budget: number, n: number): number[] {
  const out = Array.from({ length: n }, () => 3);
  let rest = Math.max(0, budget - 3 * n);
  while (rest > 0) {
    let progressed = false;
    for (let k = n - 1; k >= 0 && rest > 0; k--) {
      if (out[k]! < 45) {
        out[k]!++;
        rest--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return out;
}

/**
 * A fixed session built without the model, used after two failed model attempts.
 * `eligible` must already be filtered for age, players, space, equipment and review policy.
 */
export function buildFallbackSession(
  request: SessionRequest,
  eligible: Practice[],
  ctx: BuildContext,
): FallbackResult {
  const ranked = rankByTheme(eligible, request.focus.theme);
  const warm = ranked.find((p) => p.kind === "warmup");
  const cool = ranked.find((p) => p.kind === "cooldown");
  const skills = ranked.filter((p) => p.kind === "technical" || p.kind === "main" || p.kind === "game_related");
  const games = ranked.filter((p) => p.kind === "game" || p.kind === "game_related");
  if (!warm || !cool || skills.length === 0) {
    return { status: "error", error: { code: "NO_SUITABLE_DRILLS", message: errorMessage("NO_SUITABLE_DRILLS", request.meta.language) } };
  }

  const avail = request.meta.availableMinutes;
  const warmMin = avail < 60 ? 8 : 12;
  const coolMin = 5;

  // Game-like phase: prefer a true game, else a game-related drill.
  const gamePick = games.find((p) => p.kind === "game") ?? games[0];
  const skillPicks = skills.filter((p) => p.id !== gamePick?.id);
  const middle: Practice[] = [];
  const budget = avail - warmMin - coolMin;
  const wantSkills = budget >= 70 ? 2 : 1;
  middle.push(...skillPicks.slice(0, wantSkills));
  if (gamePick) middle.push(gamePick);
  if (middle.length === 0) {
    return { status: "error", error: { code: "NO_SUITABLE_DRILLS", message: errorMessage("NO_SUITABLE_DRILLS", request.meta.language) } };
  }
  if (budget < middle.length * 3) {
    return { status: "error", error: { code: "CONSTRAINTS_CONFLICT", message: errorMessage("CONSTRAINTS_CONFLICT", request.meta.language) } };
  }

  const mids = splitMinutes(budget, middle.length);
  const chosen = [
    { p: warm, m: warmMin },
    ...middle.map((p, i) => ({ p, m: mids[i]! })),
    { p: cool, m: coolMin },
  ];
  const total = chosen.reduce((a, c) => a + c.m, 0);
  const session: TrainingSession = {
    id: ctx.id,
    createdAt: ctx.now,
    meta: request.meta,
    focus: request.focus,
    phases: chosen.map((c, i) => ({ order: i + 1, practiceId: c.p.id, kind: c.p.kind, durationMinutes: c.m })),
    totalDurationMinutes: total,
    source: "fallback",
  };
  return { status: "ok", session: TrainingSessionSchema.parse(session) };
}
