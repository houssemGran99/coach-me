import { z } from "zod";
import { AnimationSpecSchema } from "./animation";
import {
  AgeGroupSchema, AreaSchema, EquipmentSchema, PracticeKindSchema, ThemeSchema, VariantLabelSchema, i18n,
} from "./common";

const text = (max: number) => z.string().trim().min(1).max(max);

const CoachingPoints = z.strictObject({
  fr: z.array(text(200)).min(1).max(5),
  en: z.array(text(200)).min(1).max(5),
  ar: z.array(text(200)).min(1).max(5),
});

export const VariantSchema = z.strictObject({
  label: VariantLabelSchema,
  text: i18n(300),
});

export const ReviewSchema = z.strictObject({
  status: z.enum(["pending", "reviewed", "ai_draft", "edited_by_owner"]),
  reviewedBy: z.string().trim().min(1).nullable(),
  reviewedAt: z.iso.date().nullable(),
});

export const PracticeSchema = z
  .strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "id must be snake_case or a uuid"),
    kind: PracticeKindSchema,
    ageGroups: z.array(AgeGroupSchema).min(1),
    minPlayers: z.number().int().min(1).max(60),
    maxPlayers: z.number().int().min(1).max(60),
    area: AreaSchema,
    equipment: z.array(EquipmentSchema),
    themes: z.array(ThemeSchema).min(1),
    name: i18n(80),
    organisation: i18n(600),
    coachingPoints: CoachingPoints,
    variants: z.array(VariantSchema).max(3),
    source: z.enum(["template", "ai", "user"]),
    review: ReviewSchema,
    animation: AnimationSpecSchema,
  })
  .superRefine((p, ctx) => {
    if (p.minPlayers > p.maxPlayers) {
      ctx.addIssue({ code: "custom", path: ["minPlayers"], message: "minPlayers must not exceed maxPlayers" });
    }
    if (new Set(p.ageGroups).size !== p.ageGroups.length) {
      ctx.addIssue({ code: "custom", path: ["ageGroups"], message: "duplicate age group" });
    }
    if (new Set(p.equipment).size !== p.equipment.length) {
      ctx.addIssue({ code: "custom", path: ["equipment"], message: "duplicate equipment" });
    }
    const { status, reviewedBy, reviewedAt } = p.review;
    if (status === "reviewed" && (!reviewedBy || !reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["review"],
        message: "a practice can only be 'reviewed' with a named reviewer and a date",
      });
    }
    if (status !== "reviewed" && (reviewedBy || reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["review"],
        message: "reviewedBy and reviewedAt must be null unless status is 'reviewed'",
      });
    }
    if (p.source === "ai" && status === "reviewed") {
      ctx.addIssue({ code: "custom", path: ["review", "status"], message: "AI content can never be 'reviewed'" });
    }
    const lens = [p.coachingPoints.fr.length, p.coachingPoints.en.length, p.coachingPoints.ar.length];
    if (new Set(lens).size !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["coachingPoints"],
        message: "coaching points must have the same count in fr, en and ar",
      });
    }
  });

export type Practice = z.infer<typeof PracticeSchema>;
export type Variant = z.infer<typeof VariantSchema>;

/** True when the content may be shown with a "Reviewed" label. */
export function isReviewed(p: Pick<Practice, "review" | "source">): boolean {
  return p.review.status === "reviewed" && !!p.review.reviewedBy && !!p.review.reviewedAt && p.source !== "ai";
}

/** What a coach may be shown as the trust label of a practice. */
export type TrustLabel = "reviewed" | "pending" | "ai_draft" | "edited_by_owner";
export function trustLabel(p: Pick<Practice, "review" | "source">): TrustLabel {
  if (isReviewed(p)) return "reviewed";
  if (p.review.status === "edited_by_owner") return "edited_by_owner";
  if (p.review.status === "ai_draft" || p.source === "ai") return "ai_draft";
  return "pending";
}
