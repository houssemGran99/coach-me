import type { AnimationSpec, Point, Team } from "@mourabbi/schemas";

/**
 * Pure animation core (no DOM). Semantics match the prototype exactly:
 * - each object starts a step where it ended the previous one;
 * - a listed object walks the polyline start -> waypoints and ends on the last waypoint;
 * - progress is ease-in-out quad of elapsed/durationS, mapped to arc length;
 * - `setTeam` applies at the END of its step.
 */

export interface Segment {
  index: number;
  t0: number;
  t1: number;
  /** Full polyline per moving object, starting from where it stood at t0. */
  paths: Record<string, Point[]>;
  setTeam: Record<string, Team> | null;
}

export interface TimelineObject {
  id: string;
  kind: "actor" | "ball";
  team?: Team;
  x: number;
  y: number;
}

export interface Timeline {
  segments: Segment[];
  total: number;
  objects: Record<string, TimelineObject>;
}

export interface FrameState {
  pos: Record<string, Point>;
  team: Record<string, Team>;
  /** Index of the step that is playing at time t (the last step once finished). */
  stepIndex: number;
}

export function ease(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export function buildTimeline(spec: AnimationSpec): Timeline {
  const objects: Record<string, TimelineObject> = {};
  const pos: Record<string, Point> = {};
  for (const a of spec.actors) {
    objects[a.id] = { id: a.id, kind: "actor", team: a.team, x: a.x, y: a.y };
    pos[a.id] = [a.x, a.y];
  }
  for (const b of spec.balls) {
    objects[b.id] = { id: b.id, kind: "ball", x: b.x, y: b.y };
    pos[b.id] = [b.x, b.y];
  }
  const segments: Segment[] = [];
  let t = 0;
  spec.steps.forEach((s, index) => {
    const paths: Record<string, Point[]> = {};
    for (const id of Object.keys(objects)) {
      const pts = s.moves[id];
      if (pts && pts.length) {
        paths[id] = [pos[id]!, ...pts];
        pos[id] = pts[pts.length - 1]!;
      }
    }
    segments.push({ index, t0: t, t1: t + s.durationS, paths, setTeam: s.setTeam ?? null });
    t += s.durationS;
  });
  return { segments, total: t, objects };
}

export function pathLength(path: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
  }
  return total;
}

/** Point at fraction p (0..1) of the polyline's arc length. */
export function polyAt(path: readonly Point[], p: number): Point {
  const last = path[path.length - 1]!;
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
    lens.push(l);
    total += l;
  }
  if (total === 0) return last;
  let target = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (target <= l || i === lens.length - 1) {
      const f = l ? Math.min(1, target / l) : 1;
      const a = path[i]!;
      const b = path[i + 1]!;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    target -= l;
  }
  return last;
}

export function stateAt(tl: Timeline, t: number): FrameState {
  const pos: Record<string, Point> = {};
  const team: Record<string, Team> = {};
  for (const id of Object.keys(tl.objects)) {
    const o = tl.objects[id]!;
    pos[id] = [o.x, o.y];
    if (o.team) team[id] = o.team;
  }
  let stepIndex = 0;
  const lastIndex = Math.max(0, tl.segments.length - 1);
  for (let i = 0; i < tl.segments.length; i++) {
    const s = tl.segments[i]!;
    if (t >= s.t1) {
      for (const id of Object.keys(s.paths)) {
        const p = s.paths[id]!;
        pos[id] = p[p.length - 1]!;
      }
      if (s.setTeam) Object.assign(team, s.setTeam);
      stepIndex = Math.min(i + 1, lastIndex);
    } else {
      if (t > s.t0) {
        const pr = ease((t - s.t0) / (s.t1 - s.t0));
        for (const id of Object.keys(s.paths)) pos[id] = polyAt(s.paths[id]!, pr);
      }
      stepIndex = i;
      break;
    }
  }
  return { pos, team, stepIndex };
}

/** Target time for Previous (-1) and Next (+1): Previous restarts the step if more than 0.7 s into it. */
export function seekTarget(tl: Timeline, t: number, dir: -1 | 1): number {
  const cur = tl.segments[stateAt(tl, t).stepIndex]!;
  if (dir < 0) {
    if (t - cur.t0 > 0.7) return cur.t0;
    return tl.segments[Math.max(0, cur.index - 1)]!.t0;
  }
  return cur.index < tl.segments.length - 1 ? tl.segments[cur.index + 1]!.t0 : tl.total;
}

/** Middle of a step, used for static previews. */
export function stepMidTime(tl: Timeline, index: number): number {
  const s = tl.segments[Math.min(Math.max(0, index), tl.segments.length - 1)]!;
  return (s.t0 + s.t1) / 2;
}

export function formatClock(seconds: number): string {
  const n = Math.floor(Math.max(0, seconds));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
