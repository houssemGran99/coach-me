import { describe, expect, it } from "vitest";
import {
  LlmErrorSchema, TrainingSessionSchema, areaFits, buildFallbackSession, describeProblems, filterEligible,
  hasProblem, ineligibleReasons, maxCoachingPoints, resolveSessionPlan, runSessionChecks, splitMinutes,
  type Practice, type SessionMeta, type SessionRequest,
} from "../src";
import { lookupFrom, seedPractices } from "./fixtures";

const meta = (o: Partial<SessionMeta> = {}): SessionMeta => ({
  ageGroup: "U12",
  playerCount: 10,
  availableMinutes: 90,
  space: { lengthM: 40, widthM: 30, surface: "grass" },
  equipment: ["balls", "cones", "bibs", "mini_goals", "full_goals"],
  language: "en",
  ...o,
});
const request = (o: Partial<SessionMeta> = {}): SessionRequest => ({
  meta: meta(o),
  focus: { theme: "width_and_support", sourceNote: "" },
});
const ctx = { id: "3f2b8a9e-7c1d-4e55-9b0a-2d6f1c8e4a10", now: "2026-03-01T10:00:00Z" };

const all = seedPractices();
const lookup = lookupFrom(all);
const ok = [
  { practiceId: "dynamic_warmup_ball", durationMinutes: 12 },
  { practiceId: "corner_goals_3v3_u12", durationMinutes: 25 },
  { practiceId: "small_sided_game_5v5", durationMinutes: 30 },
  { practiceId: "cooldown_walk_stretch", durationMinutes: 5 },
];
const plan = (phases = ok, total?: number) => ({
  totalDurationMinutes: total ?? phases.reduce((a, p) => a + p.durationMinutes, 0),
  phases,
});

describe("areaFits / eligibility", () => {
  it("allows rotation", () => {
    expect(areaFits({ lengthM: 30, widthM: 20 }, { lengthM: 20, widthM: 30 })).toBe(true);
    expect(areaFits({ lengthM: 30, widthM: 20 }, { lengthM: 25, widthM: 25 })).toBe(false);
  });

  it("explains why a practice is out", () => {
    const rondo = lookup("rondo_4v2_u10")!;
    const codes = ineligibleReasons(rondo, meta({ ageGroup: "U15", playerCount: 20, equipment: ["balls"], space: { lengthM: 10, widthM: 10, surface: "grass" } })).map((r) => r.code);
    expect(codes.sort()).toEqual(["age", "equipment", "players", "space"]);
  });

  it("filters before the prompt", () => {
    const ids = filterEligible(all, meta({ ageGroup: "U10" })).map((p) => p.id);
    expect(ids).toContain("rondo_4v2_u10");
    expect(ids).not.toContain("buildout_4v2_u14");
  });

  it("limits coaching points by age", () => {
    expect(maxCoachingPoints("U8")).toBe(1);
    expect(maxCoachingPoints("U9")).toBe(1);
    expect(maxCoachingPoints("U10")).toBe(3);
    expect(maxCoachingPoints("U13")).toBe(3);
    expect(maxCoachingPoints("U14")).toBe(5);
    expect(maxCoachingPoints("senior")).toBe(5);
  });
});

describe("runSessionChecks", () => {
  const run = (phases = ok, m = meta(), total?: number) =>
    runSessionChecks({ meta: m, phases: phases.map((p) => ({ ...p, kind: lookup(p.practiceId)?.kind })), totalDurationMinutes: total }, lookup);
  const status = (checks: ReturnType<typeof run>, id: string) => checks.find((c) => c.id === id)!.status;

  it("passes a valid session (review is only a warning for pending content)", () => {
    const checks = run();
    expect(hasProblem(checks)).toBe(false);
    expect(status(checks, "review")).toBe("warning");
    expect(status(checks, "time")).toBe("pass");
  });

  it("flags time over the available minutes", () => {
    const checks = run(ok, meta({ availableMinutes: 60 }));
    expect(status(checks, "time")).toBe("problem");
    expect(checks.find((c) => c.id === "time")!.params.over).toBe(12);
  });

  it("flags a total that differs from the sum", () => {
    expect(status(run(ok, meta(), 80), "time")).toBe("problem");
  });

  it("flags unknown practice ids", () => {
    const checks = run([...ok.slice(0, 3), { practiceId: "nope", durationMinutes: 5 }]);
    expect(status(checks, "known")).toBe("problem");
  });

  it("flags players outside a drill's range", () => {
    expect(status(run(ok, meta({ playerCount: 30 })), "players")).toBe("problem");
  });

  it("flags a drill that does not fit the space, and accepts rotation", () => {
    expect(status(run(ok, meta({ space: { lengthM: 25, widthM: 20, surface: "grass" } })), "space")).toBe("problem");
    expect(status(run(ok, meta({ space: { lengthM: 30, widthM: 40, surface: "grass" } })), "space")).toBe("pass");
  });

  it("flags missing equipment", () => {
    expect(status(run(ok, meta({ equipment: ["balls"] })), "equipment")).toBe("problem");
  });

  it("requires warm-up first and cool-down last", () => {
    expect(status(run([...ok].reverse()), "order")).toBe("problem");
    const swapped = [ok[1]!, ok[0]!, ok[2]!, ok[3]!];
    expect(status(run(swapped), "order")).toBe("problem");
  });

  it("warns when there is no game-like phase", () => {
    const noGame = [ok[0]!, { practiceId: "rondo_4v2_u10", durationMinutes: 20 }, ok[3]!];
    expect(status(run(noGame), "structure")).toBe("warning");
  });

  it("describes problems for the retry prompt", () => {
    const checks = run(ok, meta({ playerCount: 30, availableMinutes: 60 }));
    const text = describeProblems(checks, lookup).join(" ");
    expect(text).toContain("over the 60 available");
    expect(text).toContain("needs");
  });
});

describe("resolveSessionPlan", () => {
  const req = request();

  it("accepts a valid plan", () => {
    const r = resolveSessionPlan(plan(), req, lookup, ctx);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(TrainingSessionSchema.safeParse(r.session).success).toBe(true);
      expect(r.session.totalDurationMinutes).toBe(72);
      expect(r.session.phases.map((p) => p.order)).toEqual([1, 2, 3, 4]);
    }
  });

  it("rejects extra keys the model should not write", () => {
    const r = resolveSessionPlan({ ...plan(), title: "My session" }, req, lookup, ctx);
    expect(r.status).toBe("invalid");
  });

  it("rejects a total that is not the sum", () => {
    expect(resolveSessionPlan(plan(ok, 99), req, lookup, ctx).status).toBe("invalid");
  });

  it("rejects durations outside 3..45", () => {
    const long = ok.map((p, i) => (i === 2 ? { ...p, durationMinutes: 46 } : p));
    expect(resolveSessionPlan(plan(long), req, lookup, ctx).status).toBe("invalid");
  });

  it("rejects unknown ids", () => {
    const bad = [...ok.slice(0, 3), { practiceId: "made_up", durationMinutes: 5 }];
    const r = resolveSessionPlan(plan(bad), req, lookup, ctx);
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") expect(r.errors[0]).toContain("made_up");
  });

  it("rejects fewer than 3 phases", () => {
    expect(resolveSessionPlan(plan(ok.slice(0, 2)), req, lookup, ctx).status).toBe("invalid");
  });

  it("passes model error objects through", () => {
    const e = { error: { code: "NO_SUITABLE_DRILLS", message: "Rien ne convient." } };
    expect(LlmErrorSchema.safeParse(e).success).toBe(true);
    const r = resolveSessionPlan(e, req, lookup, ctx);
    expect(r.status).toBe("error");
  });

  it("rejects an unknown error code", () => {
    expect(resolveSessionPlan({ error: { code: "WHATEVER", message: "x" } }, req, lookup, ctx).status).toBe("invalid");
  });

  it("rejects a plan that exceeds the available time", () => {
    expect(resolveSessionPlan(plan(), request({ availableMinutes: 60 }), lookup, ctx).status).toBe("invalid");
  });
});

describe("buildFallbackSession", () => {
  it("builds a valid, flagged session", () => {
    const eligible = filterEligible(all, meta());
    const r = buildFallbackSession(request(), eligible, ctx);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.session.source).toBe("fallback");
      expect(r.session.phases[0]!.kind).toBe("warmup");
      expect(r.session.phases.at(-1)!.kind).toBe("cooldown");
      expect(r.session.totalDurationMinutes).toBeLessThanOrEqual(90);
      expect(hasProblem(runSessionChecks(r.session, lookup))).toBe(false);
    }
  });

  it("uses a short warm-up under 60 minutes", () => {
    const r = buildFallbackSession(request({ availableMinutes: 45 }), filterEligible(all, meta()), ctx);
    expect(r.status === "ok" && r.session.phases[0]!.durationMinutes).toBe(8);
  });

  it("returns NO_SUITABLE_DRILLS in the coach's language when nothing fits", () => {
    const r = buildFallbackSession(request({ language: "fr" }), [] as Practice[], ctx);
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.error.code).toBe("NO_SUITABLE_DRILLS");
      expect(r.error.message).toContain("Aucun exercice");
    }
  });

  it("splits minutes within 3..45", () => {
    expect(splitMinutes(70, 3).reduce((a, b) => a + b, 0)).toBe(70);
    expect(splitMinutes(200, 2)).toEqual([45, 45]);
    expect(Math.min(...splitMinutes(9, 3))).toBe(3);
  });
});
