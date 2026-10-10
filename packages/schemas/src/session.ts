import { z } from "zod";
import {
  AgeGroupSchema, EquipmentSchema, LangSchema, PracticeKindSchema, SurfaceSchema, ThemeSchema,
} from "./common";

export const SessionMetaSchema = z.strictObject({
  ageGroup: AgeGroupSchema,
  playerCount: z.number().int().min(2).max(60),
  availableMinutes: z.number().int().min(30).max(150),
  space: z.strictObject({
    lengthM: z.number().positive().max(300),
    widthM: z.number().positive().max(300),
    surface: SurfaceSchema,
  }),
  equipment: z.array(EquipmentSchema),
  language: LangSchema,
});
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const SessionFocusSchema = z.strictObject({
  theme: ThemeSchema,
  sourceNote: z.string().max(500),
});

export const PhaseSchema = z.strictObject({
  order: z.number().int().min(1),
  practiceId: z.string().min(1).max(64),
  kind: PracticeKindSchema,
  durationMinutes: z.number().int().min(3).max(45),
  /** Coach's private note for this phase. Never included in shared snapshots. */
  note: z.string().max(500).optional(),
});
export type Phase = z.infer<typeof PhaseSchema>;

export const ReflectionSchema = z.strictObject({
  worked: z.string().max(1000),
  didNotWork: z.string().max(1000),
  nextAction: z.string().max(1000),
  rating: z.number().int().min(1).max(5),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

export const TrainingSessionSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    meta: SessionMetaSchema,
    focus: SessionFocusSchema,
    phases: z.array(PhaseSchema).min(3),
    totalDurationMinutes: z.number().int().min(1),
    reflection: ReflectionSchema.optional(),
    /** "fallback" when the model failed twice and the session was built in code. */
    source: z.enum(["llm", "fallback"]).optional(),
  })
  .superRefine((s, ctx) => {
    s.phases.forEach((p, i) => {
      if (p.order !== i + 1) {
        ctx.addIssue({ code: "custom", path: ["phases", i, "order"], message: "phase order must run 1..n without gaps" });
      }
    });
  });
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

/** What the model is allowed to return for a session: ids and timings, nothing else. */
export const LlmSessionPlanSchema = z.strictObject({
  totalDurationMinutes: z.number().int(),
  phases: z
    .array(z.strictObject({ practiceId: z.string().min(1).max(64), durationMinutes: z.number().int() }))
    .min(3),
});
export type LlmSessionPlan = z.infer<typeof LlmSessionPlanSchema>;

export const ERROR_CODES = ["NO_SUITABLE_DRILLS", "CONSTRAINTS_CONFLICT", "OUT_OF_SCOPE"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Error object the model may return instead of a result. Message is in the coach's language. */
export const LlmErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    message: z.string().trim().min(1).max(300),
  }),
});
export type LlmError = z.infer<typeof LlmErrorSchema>;

/** Inputs of the "new session" form. */
export const SessionRequestSchema = z.strictObject({
  meta: SessionMetaSchema,
  focus: SessionFocusSchema,
});
export type SessionRequest = z.infer<typeof SessionRequestSchema>;

/** Number of coaching points to show for an age group (play-based under U10). */
export function maxCoachingPoints(age: z.infer<typeof AgeGroupSchema>): number {
  if (age === "senior") return 5;
  const n = Number(age.slice(1));
  if (n < 10) return 1;
  if (n <= 13) return 3;
  return 5;
}
