import type { Area, AnimationSpec, Point } from "@mourabbi/schemas";
import { pathLength } from "./core";

export const LIMITS = {
  minAreaM: { lengthM: 8, widthM: 8 },
  maxAreaM: { lengthM: 110, widthM: 70 },
  maxActors: 16,
  maxBalls: 8,
  maxCones: 20,
  maxGoals: 6,
  maxZones: 4,
  minSteps: 2,
  maxSteps: 10,
  minStepS: 1,
  maxStepS: 12,
  maxTotalS: 90,
  maxActorSpeed: 8, // m/s, average over a step
  maxBallSpeed: 28, // m/s, average over a step
  ballStartRadiusM: 1.5,
  maxCaptionChars: 90,
} as const;

export type IssueCode =
  | "AREA_TOO_SMALL" | "AREA_TOO_LARGE"
  | "OUT_OF_BOUNDS" | "TOO_MANY" | "STEP_COUNT" | "STEP_DURATION" | "TOTAL_DURATION"
  | "DUPLICATE_ID" | "UNKNOWN_OBJECT" | "UNKNOWN_ACTOR" | "INVALID_TEAM"
  | "ACTOR_TOO_FAST" | "BALL_TOO_FAST" | "BALL_START" | "CAPTION";

export interface SpecIssue {
  code: IssueCode;
  path: string;
  message: string;
}

const EPS = 1e-6;
const TEAMS = new Set(["a", "b", "n", "k", "c"]);
const LANGS = ["fr", "en", "ar"] as const;

const inside = (p: readonly [number, number], area: Area) =>
  p[0] >= -EPS && p[1] >= -EPS && p[0] <= area.lengthM + EPS && p[1] <= area.widthM + EPS;

const rectInside = (r: { x: number; y: number; w: number; h: number }, area: Area) =>
  r.x >= -EPS && r.y >= -EPS && r.x + r.w <= area.lengthM + EPS && r.y + r.h <= area.widthM + EPS;

function distToRect(p: readonly [number, number], r: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(r.x - p[0], 0, p[0] - (r.x + r.w));
  const dy = Math.max(r.y - p[1], 0, p[1] - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Semantic validation of an animation against the practice area.
 * Returns every issue found; an empty array means the spec is valid.
 */
export function validateSpec(spec: AnimationSpec, area: Area): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const add = (code: IssueCode, path: string, message: string) => issues.push({ code, path, message });

  // Area bounds
  if (area.lengthM < LIMITS.minAreaM.lengthM || area.widthM < LIMITS.minAreaM.widthM) {
    add("AREA_TOO_SMALL", "area", `Area ${area.lengthM} x ${area.widthM} m is below the 8 x 8 m minimum.`);
  }
  if (area.lengthM > LIMITS.maxAreaM.lengthM || area.widthM > LIMITS.maxAreaM.widthM) {
    add("AREA_TOO_LARGE", "area", `Area ${area.lengthM} x ${area.widthM} m is above the 110 x 70 m maximum.`);
  }

  // Counts
  const caps: [string, number, number][] = [
    ["actors", spec.actors.length, LIMITS.maxActors],
    ["balls", spec.balls.length, LIMITS.maxBalls],
    ["cones", spec.cones.length, LIMITS.maxCones],
    ["goals", spec.goals.length, LIMITS.maxGoals],
    ["zones", spec.zones.length, LIMITS.maxZones],
  ];
  for (const [name, n, max] of caps) {
    if (n > max) add("TOO_MANY", name, `At most ${max} ${name} are allowed, found ${n}.`);
  }
  if (spec.steps.length < LIMITS.minSteps || spec.steps.length > LIMITS.maxSteps) {
    add("STEP_COUNT", "steps", `Between ${LIMITS.minSteps} and ${LIMITS.maxSteps} steps are required, found ${spec.steps.length}.`);
  }

  // Ids
  const ids = new Map<string, "actor" | "ball">();
  for (const [kind, list] of [["actor", spec.actors], ["ball", spec.balls]] as const) {
    list.forEach((o, i) => {
      if (ids.has(o.id)) add("DUPLICATE_ID", `${kind}s[${i}].id`, `Duplicate id "${o.id}".`);
      ids.set(o.id, kind);
    });
  }
  spec.actors.forEach((a, i) => {
    if (!TEAMS.has(a.team)) add("INVALID_TEAM", `actors[${i}].team`, `Invalid team "${a.team}".`);
  });

  // Static positions
  const check = (path: string, p: readonly [number, number]) => {
    if (!inside(p, area)) add("OUT_OF_BOUNDS", path, `Position (${p[0]}, ${p[1]}) is outside the ${area.lengthM} x ${area.widthM} m area.`);
  };
  spec.actors.forEach((a, i) => check(`actors[${i}]`, [a.x, a.y]));
  spec.balls.forEach((b, i) => check(`balls[${i}]`, [b.x, b.y]));
  spec.cones.forEach((c, i) => check(`cones[${i}]`, [c.x, c.y]));
  spec.goals.forEach((g, i) => {
    if (!rectInside(g, area)) add("OUT_OF_BOUNDS", `goals[${i}]`, `Goal ${i + 1} extends outside the area.`);
  });
  spec.zones.forEach((z, i) => {
    if (!rectInside(z, area)) add("OUT_OF_BOUNDS", `zones[${i}]`, `Zone ${i + 1} extends outside the area.`);
    for (const l of LANGS) {
      if (!z.label[l]?.trim()) add("CAPTION", `zones[${i}].label.${l}`, `Zone ${i + 1} has no ${l} label.`);
    }
  });

  // Ball starts near an actor, cone or goal
  spec.balls.forEach((b, i) => {
    const p: [number, number] = [b.x, b.y];
    const near =
      spec.actors.some((a) => Math.hypot(a.x - b.x, a.y - b.y) <= LIMITS.ballStartRadiusM + EPS) ||
      spec.cones.some((c) => Math.hypot(c.x - b.x, c.y - b.y) <= LIMITS.ballStartRadiusM + EPS) ||
      spec.goals.some((g) => distToRect(p, g) <= LIMITS.ballStartRadiusM + EPS);
    if (!near) add("BALL_START", `balls[${i}]`, `Ball "${b.id}" must start within 1.5 m of an actor, cone or goal.`);
  });

  // Steps
  const pos = new Map<string, Point>();
  spec.actors.forEach((a) => pos.set(a.id, [a.x, a.y]));
  spec.balls.forEach((b) => pos.set(b.id, [b.x, b.y]));
  let total = 0;
  spec.steps.forEach((s, si) => {
    total += s.durationS;
    if (s.durationS < LIMITS.minStepS || s.durationS > LIMITS.maxStepS) {
      add("STEP_DURATION", `steps[${si}].durationS`, `Step ${si + 1} lasts ${s.durationS} s; each step must last 1 to 12 s.`);
    }
    for (const l of LANGS) {
      const c = s.caption[l];
      if (!c?.trim()) add("CAPTION", `steps[${si}].caption.${l}`, `Step ${si + 1} has no ${l} caption.`);
      else if (c.length > LIMITS.maxCaptionChars) {
        add("CAPTION", `steps[${si}].caption.${l}`, `Step ${si + 1} ${l} caption is ${c.length} chars; the maximum is ${LIMITS.maxCaptionChars}.`);
      }
    }
    for (const [id, pts] of Object.entries(s.moves)) {
      const kind = ids.get(id);
      if (!kind) {
        add("UNKNOWN_OBJECT", `steps[${si}].moves.${id}`, `Step ${si + 1} moves "${id}", which is not an actor or ball.`);
        continue;
      }
      pts.forEach((p, pi) => check(`steps[${si}].moves.${id}[${pi}]`, p));
      const start = pos.get(id)!;
      const len = pathLength([start, ...pts]);
      const speed = len / Math.max(s.durationS, EPS);
      if (kind === "actor" && speed > LIMITS.maxActorSpeed + EPS) {
        add("ACTOR_TOO_FAST", `steps[${si}].moves.${id}`, `Actor "${id}" averages ${speed.toFixed(1)} m/s in step ${si + 1}; the maximum is ${LIMITS.maxActorSpeed}.`);
      }
      if (kind === "ball" && speed > LIMITS.maxBallSpeed + EPS) {
        add("BALL_TOO_FAST", `steps[${si}].moves.${id}`, `Ball "${id}" averages ${speed.toFixed(1)} m/s in step ${si + 1}; the maximum is ${LIMITS.maxBallSpeed}.`);
      }
      pos.set(id, pts[pts.length - 1]!);
    }
    for (const [id, team] of Object.entries(s.setTeam ?? {})) {
      if (ids.get(id) !== "actor") add("UNKNOWN_ACTOR", `steps[${si}].setTeam.${id}`, `Step ${si + 1} sets the team of "${id}", which is not an actor.`);
      if (!TEAMS.has(team)) add("INVALID_TEAM", `steps[${si}].setTeam.${id}`, `Invalid team "${team}".`);
    }
  });
  if (total > LIMITS.maxTotalS + EPS) {
    add("TOTAL_DURATION", "steps", `The animation lasts ${total.toFixed(1)} s; the maximum is ${LIMITS.maxTotalS} s.`);
  }
  return issues;
}

export const isValidSpec = (spec: AnimationSpec, area: Area): boolean => validateSpec(spec, area).length === 0;

/** Smallest area (from the origin) that contains every object and waypoint of the animation. */
export function animationExtent(spec: AnimationSpec): { lengthM: number; widthM: number } {
  let l = 0;
  let w = 0;
  const see = (x: number, y: number) => {
    l = Math.max(l, x);
    w = Math.max(w, y);
  };
  for (const a of spec.actors) see(a.x, a.y);
  for (const b of spec.balls) see(b.x, b.y);
  for (const c of spec.cones) see(c.x, c.y);
  for (const g of spec.goals) see(g.x + g.w, g.y + g.h);
  for (const z of spec.zones) see(z.x + z.w, z.y + z.h);
  for (const s of spec.steps) for (const pts of Object.values(s.moves)) for (const p of pts) see(p[0], p[1]);
  return { lengthM: l, widthM: w };
}
