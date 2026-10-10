import { areaFits, type Equipment } from "./common";
import type { Practice } from "./practice";
import { isReviewed } from "./practice";
import type { SessionMeta } from "./session";

export type CheckId =
  | "time" | "known" | "age" | "players" | "space" | "equipment" | "order" | "structure" | "review";
export type CheckStatus = "pass" | "warning" | "problem";

export interface CheckFailure {
  practiceId?: string;
  /** Values for the UI message templates (e.g. {drill, min, max}). Drill names are resolved by the UI. */
  params: Record<string, string | number>;
}

export interface Check {
  id: CheckId;
  status: CheckStatus;
  /** Values for the message of the check as a whole (e.g. {sum, avail}). */
  params: Record<string, string | number>;
  failures: CheckFailure[];
}

export type PracticeLookup = (id: string) => Practice | undefined;

export interface SessionLike {
  meta: SessionMeta;
  phases: { practiceId: string; kind?: string; durationMinutes: number }[];
  totalDurationMinutes?: number;
}

const GAME_LIKE = new Set(["game", "game_related"]);
const SKILL = new Set(["technical", "main", "game_related"]);

/**
 * Cross-field checks for a session. Pure, used live in the editor and after every model call.
 * `lookup` returns only practices the user is allowed to use, so a missing id is a problem.
 */
export function runSessionChecks(session: SessionLike, lookup: PracticeLookup): Check[] {
  const { meta, phases } = session;
  const sum = phases.reduce((a, p) => a + p.durationMinutes, 0);
  const found = phases.map((ph) => ({ ph, p: lookup(ph.practiceId) }));
  const known = found.filter((f): f is { ph: (typeof phases)[number]; p: Practice } => !!f.p);

  const failures = (pred: (p: Practice) => CheckFailure | null): CheckFailure[] => {
    const out: CheckFailure[] = [];
    const seen = new Set<string>();
    for (const { p } of known) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const f = pred(p);
      if (f) out.push({ practiceId: p.id, ...f });
    }
    return out;
  };

  const checks: Check[] = [];

  // time
  const over = sum - meta.availableMinutes;
  const mismatch = session.totalDurationMinutes !== undefined && session.totalDurationMinutes !== sum;
  checks.push({
    id: "time",
    status: over > 0 || mismatch ? "problem" : "pass",
    params: { sum, avail: meta.availableMinutes, over: Math.max(0, over), total: session.totalDurationMinutes ?? sum },
    failures: mismatch ? [{ params: { sum, total: session.totalDurationMinutes ?? sum, mismatch: 1 } }] : [],
  });

  // known
  const unknown = found.filter((f) => !f.p).map((f) => ({ practiceId: f.ph.practiceId, params: {} }));
  checks.push({ id: "known", status: unknown.length ? "problem" : "pass", params: {}, failures: unknown });

  // age
  const ageF = failures((p) => (p.ageGroups.includes(meta.ageGroup) ? null : { params: { age: meta.ageGroup } }));
  checks.push({ id: "age", status: ageF.length ? "problem" : "pass", params: { age: meta.ageGroup }, failures: ageF });

  // players
  const plF = failures((p) =>
    meta.playerCount >= p.minPlayers && meta.playerCount <= p.maxPlayers
      ? null
      : { params: { min: p.minPlayers, max: p.maxPlayers, n: meta.playerCount } },
  );
  checks.push({ id: "players", status: plF.length ? "problem" : "pass", params: { n: meta.playerCount }, failures: plF });

  // space
  const have = { lengthM: meta.space.lengthM, widthM: meta.space.widthM };
  const spF = failures((p) =>
    areaFits(p.area, have) ? null : { params: { dl: p.area.lengthM, dw: p.area.widthM } },
  );
  checks.push({ id: "space", status: spF.length ? "problem" : "pass", params: { l: have.lengthM, w: have.widthM }, failures: spF });

  // equipment
  const owned = new Set<Equipment>(meta.equipment);
  const eqF = failures((p) => {
    const missing = p.equipment.filter((e) => !owned.has(e));
    return missing.length ? { params: { items: missing.join(",") } } : null;
  });
  checks.push({ id: "equipment", status: eqF.length ? "problem" : "pass", params: {}, failures: eqF });

  // order: warm-up first, cool-down last
  const kinds = found.map((f) => f.p?.kind ?? f.ph.kind);
  const orderOk = kinds.length > 0 && kinds[0] === "warmup" && kinds[kinds.length - 1] === "cooldown";
  checks.push({ id: "order", status: orderOk ? "pass" : "problem", params: {}, failures: [] });

  // structure: at least one technical/main/game-related, and a game or game-related phase
  const hasSkill = kinds.some((k) => k !== undefined && SKILL.has(k));
  const hasGame = kinds.some((k) => k !== undefined && GAME_LIKE.has(k));
  checks.push({
    id: "structure",
    status: hasSkill && hasGame ? "pass" : "warning",
    params: { skill: hasSkill ? 1 : 0, game: hasGame ? 1 : 0 },
    failures: [],
  });

  // review: unreviewed content is a warning, never a problem
  const unreviewedPractices = new Set(known.filter((k) => !isReviewed(k.p)).map((k) => k.p.id));
  const total = new Set(known.map((k) => k.p.id)).size;
  checks.push({
    id: "review",
    status: unreviewedPractices.size ? "warning" : "pass",
    params: { n: unreviewedPractices.size, total },
    failures: [...unreviewedPractices].map((practiceId) => ({ practiceId, params: {} })),
  });

  return checks;
}

export function hasProblem(checks: Check[]): boolean {
  return checks.some((c) => c.status === "problem");
}

/** English descriptions of every problem, appended to the retry prompt after a failed model call. */
export function describeProblems(checks: Check[], lookup: PracticeLookup): string[] {
  const out: string[] = [];
  const name = (id?: string) => (id ? (lookup(id)?.name.en ?? id) : "");
  for (const c of checks) {
    if (c.status !== "problem") continue;
    switch (c.id) {
      case "time":
        if (c.failures.some((f) => f.params.mismatch)) {
          out.push(`totalDurationMinutes (${c.params.total}) must equal the sum of phase durations (${c.params.sum}).`);
        }
        if (Number(c.params.over) > 0) {
          out.push(`The phases total ${c.params.sum} min, which is ${c.params.over} over the ${c.params.avail} available.`);
        }
        break;
      case "known":
        for (const f of c.failures) out.push(`practiceId "${f.practiceId}" is not in the allowed list.`);
        break;
      case "age":
        for (const f of c.failures) out.push(`"${f.practiceId}" is not suitable for ${c.params.age}.`);
        break;
      case "players":
        for (const f of c.failures) {
          out.push(`"${name(f.practiceId)}" needs ${f.params.min} to ${f.params.max} players, but there are ${f.params.n}.`);
        }
        break;
      case "space":
        for (const f of c.failures) out.push(`"${name(f.practiceId)}" needs ${f.params.dl} x ${f.params.dw} m, which does not fit.`);
        break;
      case "equipment":
        for (const f of c.failures) out.push(`"${name(f.practiceId)}" needs equipment that is not available: ${f.params.items}.`);
        break;
      case "order":
        out.push("The first phase must be a warm-up and the last phase must be a cool-down.");
        break;
      default:
        break;
    }
  }
  return out;
}
