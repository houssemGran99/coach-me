import type { Point, Step } from "@mourabbi/schemas";

/**
 * Authoring helpers for writing AnimationSpec steps by hand.
 *
 * Carry convention: a dribbled ball is listed in the same step as its owner,
 * with the owner's waypoints shifted by (0.7, 0.5) m so it stays at the foot.
 */
export const BALL_OFFSET: Point = [0.7, 0.5];

/** Shift waypoints by the ball offset. */
export const bo = (pts: readonly Point[]): Point[] => pts.map((p) => [p[0] + BALL_OFFSET[0], p[1] + BALL_OFFSET[1]]);

/** Round to 2 decimals so authored files stay readable. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * `carry([[ownerId, ballId, waypoints], ...])` returns a `moves` object where each ball
 * follows its owner at the foot offset.
 */
export function carry(entries: readonly (readonly [string, string, readonly Point[]])[]): Step["moves"] {
  const moves: Step["moves"] = {};
  for (const [owner, ball, pts] of entries) {
    moves[owner] = pts.map((p) => [r2(p[0]), r2(p[1])] as Point);
    moves[ball] = bo(pts).map((p) => [r2(p[0]), r2(p[1])] as Point);
  }
  return moves;
}

/** Merge several `moves` objects (later ones win for the same id). */
export const mix = (...parts: Step["moves"][]): Step["moves"] => Object.assign({}, ...parts);

/** Build a three-language text object. */
export const say = (en: string, fr: string, ar: string) => ({ fr, en, ar });
