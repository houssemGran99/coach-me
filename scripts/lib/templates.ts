import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGE_GROUPS, PracticeSchema, type Practice } from "@mourabbi/schemas";
import { LIMITS, validateSpec } from "@mourabbi/animation";
import { EXPECTED, expectedAges } from "./expected";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TEMPLATES_DIR = path.join(REPO_ROOT, "data/templates");

export interface LoadedTemplate {
  file: string;
  raw: unknown;
  practice?: Practice;
}

export interface Problem {
  file: string;
  message: string;
}

export function loadTemplateFiles(dir = TEMPLATES_DIR): { file: string; raw: unknown; parseError?: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      try {
        return { file, raw: JSON.parse(readFileSync(path.join(dir, file), "utf8")) as unknown };
      } catch (e) {
        return { file, raw: null, parseError: (e as Error).message };
      }
    });
}

const ARABIC = /[؀-ۿ]/;
const hasArabic = (s: string) => ARABIC.test(s);

/** Collect all human text of a practice by language, for script checks. */
function textsOf(p: Practice): { lang: "fr" | "en" | "ar"; where: string; text: string }[] {
  const out: { lang: "fr" | "en" | "ar"; where: string; text: string }[] = [];
  for (const lang of ["fr", "en", "ar"] as const) {
    out.push({ lang, where: "name", text: p.name[lang] });
    out.push({ lang, where: "organisation", text: p.organisation[lang] });
    p.coachingPoints[lang].forEach((t, i) => out.push({ lang, where: `coachingPoints[${i}]`, text: t }));
    p.variants.forEach((v, i) => out.push({ lang, where: `variants[${i}]`, text: v.text[lang] }));
    p.animation.steps.forEach((s, i) => out.push({ lang, where: `steps[${i}].caption`, text: s.caption[lang] }));
    p.animation.zones.forEach((z, i) => out.push({ lang, where: `zones[${i}].label`, text: z.label[lang] }));
  }
  return out;
}

export interface ValidateOptions {
  dir?: string;
  /** Allow templates from the brief's list to be missing (during authoring). */
  partial?: boolean;
}

/** Everything `pnpm templates:validate` checks. Returns a list of problems; empty means success. */
export function validateTemplates(opts: ValidateOptions = {}): { problems: Problem[]; practices: Practice[] } {
  const problems: Problem[] = [];
  const practices: Practice[] = [];
  const add = (file: string, message: string) => problems.push({ file, message });
  const files = loadTemplateFiles(opts.dir);
  const seen = new Map<string, string>();

  for (const { file, raw, parseError } of files) {
    if (parseError) {
      add(file, `invalid JSON: ${parseError}`);
      continue;
    }
    const r = PracticeSchema.safeParse(raw);
    if (!r.success) {
      for (const i of r.error.issues) add(file, `schema: ${i.path.join(".") || "(root)"}: ${i.message}`);
      continue;
    }
    const p = r.data;
    practices.push(p);

    if (file !== `${p.id}.json`) add(file, `file name must be ${p.id}.json`);
    if (!/^[a-z][a-z0-9_]*$/.test(p.id)) add(file, `id "${p.id}" must be snake_case`);
    const dup = seen.get(p.id);
    if (dup) add(file, `duplicate id "${p.id}" (also in ${dup})`);
    seen.set(p.id, file);

    if (p.source !== "template") add(file, `source must be "template", got "${p.source}"`);
    if (p.review.status !== "pending" && p.review.status !== "reviewed") {
      add(file, `review.status must be "pending" or "reviewed", got "${p.review.status}"`);
    }

    // Animation rules
    for (const i of validateSpec(p.animation, p.area)) add(file, `animation ${i.code} at ${i.path}: ${i.message}`);
    if (p.animation.steps.length < 2 || p.animation.steps.length > 8) {
      add(file, `templates need 2 to 8 steps, found ${p.animation.steps.length}`);
    }

    // Ranges
    const idx = p.ageGroups.map((a) => AGE_GROUPS.indexOf(a));
    const sorted = [...idx].sort((a, b) => a - b);
    if (idx.join() !== sorted.join()) add(file, "ageGroups must be listed from youngest to oldest");
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k]! - sorted[k - 1]! !== 1) add(file, "ageGroups must be one contiguous range");
    }
    if (p.minPlayers > p.maxPlayers) add(file, "minPlayers exceeds maxPlayers");
    if (p.difficulty === undefined) add(file, "difficulty (1-3) is missing");

    // Area vs actors: each player disc is ~3 m^2; require at least 4 m^2 of pitch per actor.
    const actors = p.animation.actors.length;
    const areaM2 = p.area.lengthM * p.area.widthM;
    if (areaM2 < actors * 4) add(file, `area ${areaM2} m2 is too small for ${actors} actors (need 4 m2 each)`);
    const players = p.animation.actors.filter((a) => a.team !== "c").length;
    if (players > p.maxPlayers + 1) add(file, `animation shows ${players} players but maxPlayers is ${p.maxPlayers}`);
    if (actors > LIMITS.maxActors) add(file, "too many actors");

    // Three languages really present
    for (const t of textsOf(p)) {
      if (t.lang === "ar" && !hasArabic(t.text)) add(file, `${t.where} (ar) has no Arabic text: "${t.text}"`);
      if (t.lang !== "ar" && hasArabic(t.text)) add(file, `${t.where} (${t.lang}) contains Arabic text`);
    }
    if (p.name.en === p.name.fr && p.organisation.en === p.organisation.fr) {
      add(file, "fr text is identical to en; it must be translated");
    }

    // Match the brief's table
    const exp = EXPECTED.find((e) => e.id === p.id);
    if (!exp) {
      add(file, `id "${p.id}" is not in the brief's list of 34 templates`);
    } else {
      if (p.kind !== exp.kind) add(file, `kind ${p.kind} differs from the brief (${exp.kind})`);
      if (p.ageGroups.join() !== expectedAges(exp).join()) {
        add(file, `ageGroups ${p.ageGroups[0]}-${p.ageGroups.at(-1)} differ from the brief (${exp.ages.join("-")})`);
      }
      if (p.minPlayers !== exp.players[0] || p.maxPlayers !== exp.players[1]) {
        add(file, `players ${p.minPlayers}-${p.maxPlayers} differ from the brief (${exp.players.join("-")})`);
      }
      if (p.area.lengthM !== exp.area[0] || p.area.widthM !== exp.area[1]) {
        add(file, `area ${p.area.lengthM}x${p.area.widthM} differs from the brief (${exp.area.join("x")})`);
      }
    }
  }

  if (!opts.partial) {
    for (const e of EXPECTED) {
      if (!seen.has(e.id)) add(`${e.id}.json`, `missing template #${e.n} from the brief`);
    }
  }
  return { problems, practices };
}
