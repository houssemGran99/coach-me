import {
  AGE_GROUPS, PracticeSchema, areaFits, z, type AgeGroup, type Equipment, type Practice, type PracticeKind, type Theme,
} from "@mourabbi/schemas";
import raw from "./generated/templates.json";

let cache: Practice[] | null = null;

/** The ready-made templates, parsed once. Generated from data/templates by `pnpm templates:bundle`. */
export function getTemplates(): Practice[] {
  cache ??= z.array(PracticeSchema).parse(raw as unknown);
  return cache;
}

export function getTemplate(id: string): Practice | undefined {
  return getTemplates().find((t) => t.id === id);
}

export interface TemplateFilters {
  q?: string;
  kind?: PracticeKind;
  age?: AgeGroup;
  theme?: Theme;
  players?: number;
  /** Equipment the coach has; a template needing anything else is hidden. Empty means no filter. */
  equipment?: Equipment[];
  lengthM?: number;
  widthM?: number;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterPractices(list: Practice[], f: TemplateFilters): Practice[] {
  const q = f.q ? norm(f.q.trim()) : "";
  return list.filter((p) => {
    if (f.kind && p.kind !== f.kind) return false;
    if (f.age && !p.ageGroups.includes(f.age)) return false;
    if (f.theme && !p.themes.includes(f.theme)) return false;
    if (f.players !== undefined && (f.players < p.minPlayers || f.players > p.maxPlayers)) return false;
    if (f.equipment && f.equipment.length) {
      const have = new Set(f.equipment);
      if (p.equipment.some((e) => !have.has(e))) return false;
    }
    if (f.lengthM && f.widthM && !areaFits(p.area, { lengthM: f.lengthM, widthM: f.widthM })) return false;
    if (q) {
      const hay = norm([p.id.replaceAll("_", " "), p.name.fr, p.name.en, p.name.de, p.organisation.fr, p.organisation.en].join(" "));
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

const num = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Parse and validate `searchParams` of the gallery into filters; unknown values are ignored. */
export function parseFilters(params: Params): TemplateFilters {
  const kinds = ["warmup", "technical", "game_related", "main", "game", "cooldown"];
  const themes = [
    "possession", "passing", "receiving", "width_and_support", "pressing", "transition", "finishing",
    "decision_making", "dribbling", "1v1_attacking", "1v1_defending", "goalkeeping", "other",
  ];
  const equip = ["balls", "cones", "bibs", "mini_goals", "full_goals"];
  const kind = one(params.kind);
  const age = one(params.age);
  const theme = one(params.theme);
  const eq = params.equip === undefined ? [] : Array.isArray(params.equip) ? params.equip : [params.equip];
  return {
    q: one(params.q)?.slice(0, 80),
    kind: kind && kinds.includes(kind) ? (kind as PracticeKind) : undefined,
    age: age && (AGE_GROUPS as readonly string[]).includes(age) ? (age as AgeGroup) : undefined,
    theme: theme && themes.includes(theme) ? (theme as Theme) : undefined,
    players: num(one(params.players)),
    equipment: eq.filter((e) => equip.includes(e)) as Equipment[],
    lengthM: num(one(params.l)),
    widthM: num(one(params.w)),
  };
}
