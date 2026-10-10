import { describe, expect, it } from "vitest";
import { buildTimeline, ease, formatClock, polyAt, seekTarget, stateAt, stepMidTime } from "../src/core";
import { bo, carry } from "../src/authoring";
import { seed } from "../../schemas/test/fixtures";

const close = (a: readonly number[], b: readonly number[], eps = 1e-6) => {
  expect(a[0]).toBeCloseTo(b[0]!, 5);
  expect(a[1]).toBeCloseTo(b[1]!, 5);
  void eps;
};

describe("ease and polyAt", () => {
  it("eases in and out", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(0.75)).toBeGreaterThan(0.75);
  });

  it("maps progress to arc length across several segments", () => {
    const path: [number, number][] = [[0, 0], [10, 0], [10, 10]]; // length 20
    close(polyAt(path, 0), [0, 0]);
    close(polyAt(path, 0.25), [5, 0]);
    close(polyAt(path, 0.5), [10, 0]);
    close(polyAt(path, 0.75), [10, 5]);
    close(polyAt(path, 1), [10, 10]);
  });

  it("handles zero-length paths", () => {
    close(polyAt([[3, 3], [3, 3]], 0.5), [3, 3]);
  });
});

describe("buildTimeline", () => {
  const p = seed("rondo_4v2_u10");
  const tl = buildTimeline(p.animation);

  it("sums step durations and chains segments", () => {
    expect(tl.total).toBeCloseTo(13, 5);
    expect(tl.segments).toHaveLength(5);
    expect(tl.segments[0]!.t0).toBe(0);
    for (let i = 1; i < tl.segments.length; i++) expect(tl.segments[i]!.t0).toBeCloseTo(tl.segments[i - 1]!.t1, 9);
  });

  it("starts each step where the previous one ended", () => {
    // ball b: step 1 ends at (14.5, 8); step 2 path starts there
    expect(tl.segments[1]!.paths.b![0]).toEqual([14.5, 8]);
  });

  it("ignores objects that are not in moves", () => {
    expect(tl.segments[0]!.paths.a1).toBeUndefined();
  });
});

describe("stateAt", () => {
  const p = seed("rondo_4v2_u10");
  const tl = buildTimeline(p.animation);

  it("returns the initial layout at t = 0", () => {
    const s = stateAt(tl, 0);
    expect(s.stepIndex).toBe(0);
    expect(s.pos.b).toEqual([8.2, 1.7]);
    expect(s.team.a1).toBe("a");
    expect(s.team.d1).toBe("b");
  });

  it("is half way along the path in the middle of a step", () => {
    // step 1: ball (8.2,1.7) -> (14.5,8); the ease at p=0.5 is 0.5
    const s = stateAt(tl, 1.25);
    expect(s.stepIndex).toBe(0);
    close(s.pos.b!, [(8.2 + 14.5) / 2, (1.7 + 8) / 2]);
  });

  it("applies a finished step at its boundary and reports the next step", () => {
    const s = stateAt(tl, 2.5);
    expect(s.stepIndex).toBe(1);
    expect(s.pos.b).toEqual([14.5, 8]);
    expect(s.pos.d1).toEqual([9, 6.5]);
  });

  it("finishes on the last step with final positions", () => {
    const s = stateAt(tl, tl.total);
    expect(s.stepIndex).toBe(4);
    expect(s.pos.b).toEqual([2.7, 9.5]);
    const later = stateAt(tl, tl.total + 50);
    expect(later.pos).toEqual(s.pos);
    expect(later.stepIndex).toBe(4);
  });

  it("changes teams only at the END of the step (setTeam)", () => {
    const last = tl.segments[4]!;
    const mid = stateAt(tl, (last.t0 + last.t1) / 2);
    expect(mid.team.a4).toBe("a");
    expect(mid.team.d1).toBe("b");
    const end = stateAt(tl, last.t1);
    expect(end.team.a4).toBe("b");
    expect(end.team.d1).toBe("a");
  });

  it("keeps a carried ball on the dribbler's foot throughout", () => {
    const w = buildTimeline(seed("dynamic_warmup_ball").animation);
    for (let t = 0; t <= 4; t += 0.25) {
      const s = stateAt(w, t);
      close([s.pos.b1![0] - s.pos.p1![0], s.pos.b1![1] - s.pos.p1![1]], [0.7, 0.5]);
      close([s.pos.b4![0] - s.pos.p4![0], s.pos.b4![1] - s.pos.p4![1]], [0.7, 0.5]);
    }
  });
});

describe("seekTarget", () => {
  const tl = buildTimeline(seed("rondo_4v2_u10").animation); // steps start 0, 2.5, 5, 7.5, 10

  it("next goes to the start of the next step, then to the end", () => {
    expect(seekTarget(tl, 0.3, 1)).toBe(2.5);
    expect(seekTarget(tl, 6, 1)).toBe(7.5);
    expect(seekTarget(tl, 11, 1)).toBe(tl.total);
  });

  it("previous restarts the step if more than 0.7 s in, otherwise goes back one", () => {
    expect(seekTarget(tl, 6, -1)).toBe(5);
    expect(seekTarget(tl, 5.5, -1)).toBe(2.5);
    expect(seekTarget(tl, 0.2, -1)).toBe(0);
    expect(seekTarget(tl, 0, -1)).toBe(0);
  });
});

describe("helpers", () => {
  it("formats the clock", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(7.9)).toBe("00:07");
    expect(formatClock(75)).toBe("01:15");
  });

  it("finds the middle of a step", () => {
    const tl = buildTimeline(seed("rondo_4v2_u10").animation);
    expect(stepMidTime(tl, 0)).toBeCloseTo(1.25);
    expect(stepMidTime(tl, 99)).toBeCloseTo(11.5);
  });

  it("authoring: carry keeps the ball at the foot offset", () => {
    expect(bo([[1, 1]])).toEqual([[1.7, 1.5]]);
    expect(carry([["p", "b", [[2, 2], [4, 3]]]])).toEqual({ p: [[2, 2], [4, 3]], b: [[2.7, 2.5], [4.7, 3.5]] });
  });
});
