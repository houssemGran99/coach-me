import { z } from "zod";
import { AreaSchema, i18n } from "./common";
import { PracticeSchema, VariantSchema } from "./practice";
import { LlmErrorSchema } from "./session";

const Points = z.array(z.string().trim().min(1).max(200)).min(1).max(5);

/** Mode A: the model rewrites the text of a template for the request. The animation stays the template's own. */
export const TemplateAdaptationSchema = z
  .strictObject({
    mode: z.literal("template"),
    templateId: z.string().min(1).max(64),
    name: i18n(80),
    organisation: i18n(600),
    coachingPoints: z.strictObject({ fr: Points, en: Points, ar: Points, de: Points.optional() }),
    variants: z.array(VariantSchema).max(3),
    area: AreaSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const n = [v.coachingPoints.fr.length, v.coachingPoints.en.length, v.coachingPoints.ar.length, v.coachingPoints.de?.length ?? v.coachingPoints.en.length];
    if (new Set(n).size !== 1) {
      ctx.addIssue({ code: "custom", path: ["coachingPoints"], message: "coaching points must have the same count in every language" });
    }
  });
export type TemplateAdaptation = z.infer<typeof TemplateAdaptationSchema>;

/** Mode B: a full practice, including its animation. */
export const FreeformReplySchema = z.strictObject({ mode: z.literal("freeform"), practice: PracticeSchema });
export type FreeformReply = z.infer<typeof FreeformReplySchema>;

export const PracticeReplySchema = z.union([TemplateAdaptationSchema, FreeformReplySchema, LlmErrorSchema]);
