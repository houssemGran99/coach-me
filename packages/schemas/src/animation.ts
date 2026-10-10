import { z } from "zod";
import { Metres, i18n } from "./common";

/**
 * Structural schema for AnimationSpec. Coordinates are in metres, origin top-left,
 * x along lengthM, y along widthM. Semantic rules (bounds, speeds, counts, ...)
 * live in `@mourabbi/animation/validate`.
 */
export const CONE_COLORS = ["o", "y", "w", "r"] as const;
export type ConeColor = (typeof CONE_COLORS)[number];

export const TEAMS = ["a", "b", "n", "k", "c"] as const;
export type Team = (typeof TEAMS)[number];
export const TeamSchema = z.enum(TEAMS);

const Point = z.tuple([Metres, Metres]);
export type Point = z.infer<typeof Point>;

export const ConeSchema = z.strictObject({ x: Metres, y: Metres, color: z.enum(CONE_COLORS) });
export const GoalSchema = z.strictObject({ x: Metres, y: Metres, w: z.number().positive(), h: z.number().positive() });
export const ZoneSchema = z.strictObject({
  x: Metres, y: Metres, w: z.number().positive(), h: z.number().positive(), label: i18n(40),
});
export const ActorSchema = z.strictObject({
  id: z.string().min(1).max(24),
  team: TeamSchema,
  label: z.string().min(1).max(2),
  x: Metres,
  y: Metres,
});
export const BallSchema = z.strictObject({ id: z.string().min(1).max(24), x: Metres, y: Metres });

export const StepSchema = z.strictObject({
  durationS: z.number().positive(),
  caption: i18n(200),
  moves: z.record(z.string(), z.array(Point).min(1)),
  setTeam: z.record(z.string(), TeamSchema).optional(),
});

export const AnimationSpecSchema = z.strictObject({
  halfway: z.boolean(),
  cones: z.array(ConeSchema),
  goals: z.array(GoalSchema),
  zones: z.array(ZoneSchema),
  actors: z.array(ActorSchema),
  balls: z.array(BallSchema),
  steps: z.array(StepSchema).min(1),
});

export type Cone = z.infer<typeof ConeSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Ball = z.infer<typeof BallSchema>;
export type Step = z.infer<typeof StepSchema>;
export type AnimationSpec = z.infer<typeof AnimationSpecSchema>;
