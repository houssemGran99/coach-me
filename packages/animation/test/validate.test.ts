import { describe, expect, it } from "vitest";
import type { AnimationSpec, Practice } from "@mourabbi/schemas";
import { LIMITS, validateSpec, type IssueCode } from "../src/validate";
import { seed, seedPractices } from "../../schemas/test/fixtures";

/** Base practice: valid under every rule. */
const base = (): Practice => seed("corner_goals_3v3_u12");
const issues = (p: Practice) => validateSpec(p.animation, p.area);
const codes = (p: Practice) => issues(p).map((i) => i.code);
const only = (p: Practice, code: IssueCode) => {
  const found = codes(p);
  expect(found).toContain(code);
  return found;
};

describe("validateSpec", () => {
  it("accepts every seed practice", () => {
    for (const p of seedPractices()) expect(issues(p), p.id).toEqual([]);
  });

  it("rejects an area below 8 x 8 and above 110 x 70", () => {
    const small = base();
    small.area = { lengthM: 7, widthM: 20 };
    only(small, "AREA_TOO_SMALL");
    const big = base();
    big.area = { lengthM: 111, widthM: 20 };
    only(big, "AREA_TOO_LARGE");
    const wide = base();
    wide.area = { lengthM: 100, widthM: 71 };
    only(wide, "AREA_TOO_LARGE");
  });

  it("rejects positions outside the area (actor, ball, cone, goal, zone)", () => {
    const a = base();
    a.animation.actors[8]!.x = 30.5; // a neutral far from the ball
    expect(only(a, "OUT_OF_BOUNDS")).toEqual(["OUT_OF_BOUNDS"]);
    const b = base();
    b.animation.balls[0]!.y = -0.1;
    only(b, "OUT_OF_BOUNDS");
    const c = base();
    c.animation.cones.push({ x: 40, y: 5, color: "o" });
    only(c, "OUT_OF_BOUNDS");
    const g = base();
    g.animation.goals[0]!.w = 40;
    only(g, "OUT_OF_BOUNDS");
    const z = seed("buildout_4v2_u14");
    z.animation.zones[0]!.h = 30;
    only(z, "OUT_OF_BOUNDS");
  });

  it("rejects a waypoint outside the area, so no actor path leaves it", () => {
    const p = base();
    p.animation.steps[0]!.moves.a2 = [[10, 3.5], [10, 25]];
    expect(only(p, "OUT_OF_BOUNDS")[0]).toBe("OUT_OF_BOUNDS");
  });

  it("limits object counts", () => {
    const mk = (n: number, make: (i: number) => unknown) => Array.from({ length: n }, (_, i) => make(i));
    const actors = base();
    actors.animation.actors = mk(17, (i) => ({ id: `x${i}`, team: "a", label: "1", x: 5, y: 5 })) as AnimationSpec["actors"];
    actors.animation.balls = [];
    actors.animation.steps = actors.animation.steps.map((s) => ({ ...s, moves: {} }));
    only(actors, "TOO_MANY");
    const balls = base();
    balls.animation.balls = mk(9, (i) => ({ id: `q${i}`, x: 8, y: 10 })) as AnimationSpec["balls"];
    only(balls, "TOO_MANY");
    const cones = base();
    cones.animation.cones = mk(21, () => ({ x: 5, y: 5, color: "o" })) as AnimationSpec["cones"];
    only(cones, "TOO_MANY");
    const goals = base();
    goals.animation.goals = mk(7, () => ({ x: 1, y: 1, w: 1, h: 1 })) as AnimationSpec["goals"];
    only(goals, "TOO_MANY");
    const zones = base();
    const label = { fr: "z", en: "z" };
    zones.animation.zones = mk(5, () => ({ x: 1, y: 1, w: 2, h: 2, label })) as AnimationSpec["zones"];
    only(zones, "TOO_MANY");
  });

  it("requires 2 to 10 steps", () => {
    const one = base();
    one.animation.steps = [one.animation.steps[0]!];
    only(one, "STEP_COUNT");
    const many = base();
    const s = many.animation.steps[2]!;
    many.animation.steps = Array.from({ length: 11 }, () => structuredClone(s));
    only(many, "STEP_COUNT");
  });

  it("requires each step to last 1 to 12 s", () => {
    const short = base();
    short.animation.steps[0]!.durationS = 0.9;
    only(short, "STEP_DURATION");
    const long = base();
    long.animation.steps[0]!.durationS = 12.5;
    only(long, "STEP_DURATION");
  });

  it("caps the total at 90 s", () => {
    const p = base();
    p.animation.steps = Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(p.animation.steps[2]!), durationS: 12 })).slice(0, 8);
    expect(codes(p)).toContain("TOTAL_DURATION");
    expect(codes(p)).not.toContain("STEP_DURATION");
  });

  it("requires unique ids", () => {
    const p = base();
    p.animation.actors[1]!.id = p.animation.actors[0]!.id;
    only(p, "DUPLICATE_ID");
    const q = base();
    q.animation.balls[0]!.id = "a1";
    only(q, "DUPLICATE_ID");
  });

  it("requires moves to refer to existing objects", () => {
    const p = base();
    p.animation.steps[0]!.moves.ghost = [[5, 5]];
    only(p, "UNKNOWN_OBJECT");
  });

  it("requires setTeam to refer to existing actors with valid teams", () => {
    const p = seed("rondo_4v2_u10");
    p.animation.steps[4]!.setTeam = { b: "a" }; // b is a ball
    only(p, "UNKNOWN_ACTOR");
    const q = seed("rondo_4v2_u10");
    (q.animation.steps[4]!.setTeam as Record<string, string>).a4 = "z";
    only(q, "INVALID_TEAM");
    const r = base();
    (r.animation.actors[0] as { team: string }).team = "q";
    only(r, "INVALID_TEAM");
  });

  it("limits average speed: actors 8 m/s, balls 28 m/s", () => {
    const a = base();
    a.animation.steps[0]!.durationS = 1;
    a.animation.steps[0]!.moves.a2 = [[10, 3.5], [24, 3.5]]; // 14+ m in 1 s
    only(a, "ACTOR_TOO_FAST");
    const b = base();
    b.animation.steps[0]!.durationS = 1;
    b.animation.steps[0]!.moves.b = [[29, 19], [1, 1], [29, 19]]; // ~100 m in 1 s
    only(b, "BALL_TOO_FAST");
    // Just under the limits is fine.
    const ok = base();
    ok.animation.steps[0]!.durationS = 2;
    ok.animation.steps[0]!.moves = { a2: [[12 + 3, 5]] };
    expect(codes(ok)).not.toContain("ACTOR_TOO_FAST");
    expect(LIMITS.maxActorSpeed).toBe(8);
    expect(LIMITS.maxBallSpeed).toBe(28);
  });

  it("requires a ball to start within 1.5 m of an actor, cone or goal", () => {
    const p = base();
    p.animation.balls[0]!.x = 20;
    p.animation.balls[0]!.y = 10;
    only(p, "BALL_START");
    // Near a cone is fine.
    const q = base();
    q.animation.balls[0] = { id: "b", x: 5.4, y: 5 };
    q.animation.cones.push({ x: 5, y: 5, color: "o" });
    q.animation.actors = q.animation.actors.map((a) => ({ ...a, x: Math.min(a.x + 6, 29), y: a.y }));
    expect(codes(q)).not.toContain("BALL_START");
    // Near a goal is fine.
    const r = base();
    r.animation.balls[0] = { id: "b", x: 1.2, y: 2 }; // 0.9 m from goal edge
    r.animation.actors = r.animation.actors.map((a) => ({ ...a, x: 20, y: 10 }));
    expect(codes(r)).not.toContain("BALL_START");
  });

  it("requires captions in fr and en, at most 90 chars", () => {
    const p = base();
    p.animation.steps[0]!.caption.fr = "";
    only(p, "CAPTION");
    const q = base();
    q.animation.steps[1]!.caption.en = "x".repeat(91);
    only(q, "CAPTION");
    const r = base();
    r.animation.steps[1]!.caption.en = "x".repeat(90);
    expect(codes(r)).not.toContain("CAPTION");
  });
});
