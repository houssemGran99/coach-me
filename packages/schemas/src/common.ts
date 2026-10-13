import { z } from "zod";

export const LANGS = ["fr", "en"] as const;
export type Lang = (typeof LANGS)[number];
/** Arabic and German were removed: an old "ar" or "de" from stored data or an old client reads as French (the default). */
export const LangSchema = z.preprocess((v) => (v === "ar" || v === "de" ? "fr" : v), z.enum(LANGS));

const REMOVED_LANGS = ["ar", "de"];
/** Drops the keys of removed languages that practices saved earlier still carry. */
export const dropRemovedLangs = (v: unknown): unknown =>
  v && typeof v === "object" && !Array.isArray(v) && REMOVED_LANGS.some((k) => k in v)
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !REMOVED_LANGS.includes(k)))
    : v;

export const AGE_GROUPS = [
  "U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U19", "senior",
] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const AgeGroupSchema = z.enum(AGE_GROUPS);

/** Inclusive range of age groups, e.g. ageRange("U9", "U11"). */
export function ageRange(from: AgeGroup, to: AgeGroup): AgeGroup[] {
  return AGE_GROUPS.slice(AGE_GROUPS.indexOf(from), AGE_GROUPS.indexOf(to) + 1);
}

/** Numeric age for U-groups (U10 -> 10); seniors and unknowns return Infinity. */
export function ageNumber(a: AgeGroup): number {
  return a === "senior" ? Infinity : Number(a.slice(1));
}

export const PRACTICE_KINDS = ["warmup", "technical", "game_related", "main", "game", "cooldown"] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export const PracticeKindSchema = z.enum(PRACTICE_KINDS);

export const EQUIPMENT = ["balls", "cones", "bibs", "mini_goals", "full_goals"] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const EquipmentSchema = z.enum(EQUIPMENT);

export const THEMES = [
  "possession", "passing", "receiving", "width_and_support", "pressing", "transition", "finishing",
  "decision_making", "dribbling", "1v1_attacking", "1v1_defending", "goalkeeping", "other",
] as const;
export type Theme = (typeof THEMES)[number];
export const ThemeSchema = z.enum(THEMES);

export const SURFACES = ["grass", "artificial", "indoor", "gravel", "other"] as const;
export type Surface = (typeof SURFACES)[number];
export const SurfaceSchema = z.enum(SURFACES);

export const VARIANT_LABELS = [
  "easier", "harder", "progression_for_stronger_players", "progression_for_weaker_players",
] as const;
export type VariantLabel = (typeof VARIANT_LABELS)[number];
export const VariantLabelSchema = z.enum(VARIANT_LABELS);

export const SOURCES = ["template", "ai", "user"] as const;
export type Source = (typeof SOURCES)[number];

export const REVIEW_STATUSES = ["pending", "reviewed", "ai_draft", "edited_by_owner"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * A string in each supported language. Every field is required and non-empty. Leftover text of removed languages
 * ("ar", "de") in stored practices is ignored.
 */
export function i18n(max: number) {
  const s = z.string().trim().min(1).max(max);
  return z.preprocess(dropRemovedLangs, z.strictObject({ fr: s, en: s }));
}
export type I18n = Record<Lang, string>;

const finite = z.number().refine(Number.isFinite, "must be a finite number");
export const Metres = finite;

/** Practice or user space in metres. */
export const AreaSchema = z.strictObject({
  lengthM: z.number().positive().max(300),
  widthM: z.number().positive().max(300),
});
export type Area = z.infer<typeof AreaSchema>;

/** True when `need` fits in `have`, allowing a quarter-turn rotation. */
export function areaFits(need: Area, have: Area): boolean {
  return (
    (need.lengthM <= have.lengthM && need.widthM <= have.widthM) ||
    (need.lengthM <= have.widthM && need.widthM <= have.lengthM)
  );
}
