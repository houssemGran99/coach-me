import type { Lang, Practice } from "@mourabbi/schemas";
import type { LlmRequest } from "./types";

interface Ctx {
  constraints?: { age?: Practice["ageGroups"][number]; players?: number };
  mode: "template" | "freeform" | "refine";
  template?: Practice;
  inspiration?: Practice[];
  previous?: Practice | null;
  message: string;
  lang: Lang;
}

const SUFFIX = { en: "(adapted)", fr: "(adapté)" } as const;
const REFINED = { en: "(v2)", fr: "(v2)" } as const;

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
      name: { fr: `${t.name.fr} ${SUFFIX.fr}`, en: `${t.name.en} ${SUFFIX.en}` },
      organisation: t.organisation,
      coachingPoints: t.coachingPoints,
      variants: t.variants,
    };
  }
  if (c.mode === "refine" && c.previous) {
    const p = structuredClone(c.previous);
    for (const l of ["fr", "en"] as const) p.name[l] = `${p.name[l].replace(/ \(v\d+\)$/, "")} ${REFINED[l]}`;
    return { mode: "freeform", practice: p };
  }
  const base = structuredClone(c.inspiration?.[0]);
  if (!base) return { error: { code: "NO_SUITABLE_DRILLS", message: "No template to start from." } };
  // Respect what the coach asked for, like a real model would.
  if (c.constraints?.age) base.ageGroups = [c.constraints.age];
  if (c.constraints?.players !== undefined) {
    base.minPlayers = Math.min(base.minPlayers, c.constraints.players);
    base.maxPlayers = Math.max(base.maxPlayers, c.constraints.players);
  }
  const label = c.message.trim().slice(0, 40);
  for (const l of ["fr", "en"] as const) base.name[l] = `${base.name[l]} · ${label}`.slice(0, 80);
  return { mode: "freeform", practice: base };
}
