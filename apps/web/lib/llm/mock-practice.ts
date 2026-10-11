import type { Lang, Practice } from "@mourabbi/schemas";
import type { LlmRequest } from "./types";

interface Ctx {
  mode: "template" | "freeform" | "refine";
  template?: Practice;
  inspiration?: Practice[];
  previous?: Practice | null;
  message: string;
  lang: Lang;
}

const SUFFIX = { en: "(adapted)", fr: "(adapté)", ar: "(مكيّف)" } as const;
const REFINED = { en: "(v2)", fr: "(v2)", ar: "(v2)" } as const;

/**
 * Deterministic stand-in for the model's practice replies (local development and end-to-end tests).
 * It follows the same contract as the real model: adapt a template's text, or return a full practice.
 */
export async function mockPracticeReply(req: LlmRequest): Promise<unknown> {
  const c = req.context as Ctx;
  if (c.mode === "template" && c.template) {
    const t = c.template;
    return {
      mode: "template",
      templateId: t.id,
      name: { fr: `${t.name.fr} ${SUFFIX.fr}`, en: `${t.name.en} ${SUFFIX.en}`, ar: `${t.name.ar} ${SUFFIX.ar}` },
      organisation: t.organisation,
      coachingPoints: t.coachingPoints,
      variants: t.variants,
    };
  }
  if (c.mode === "refine" && c.previous) {
    const p = structuredClone(c.previous);
    for (const l of ["fr", "en", "ar"] as const) p.name[l] = `${p.name[l].replace(/ \(v\d+\)$/, "")} ${REFINED[l]}`;
    return { mode: "freeform", practice: p };
  }
  const base = structuredClone(c.inspiration?.[0]);
  if (!base) return { error: { code: "NO_SUITABLE_DRILLS", message: "No template to start from." } };
  const label = c.message.trim().slice(0, 40);
  for (const l of ["fr", "en", "ar"] as const) base.name[l] = `${base.name[l]} · ${label}`.slice(0, 80);
  return { mode: "freeform", practice: base };
}
