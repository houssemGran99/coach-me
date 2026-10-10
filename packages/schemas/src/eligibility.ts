import { areaFits, type Equipment, type Theme } from "./common";
import type { Practice } from "./practice";
import type { SessionMeta } from "./session";

export interface Reason {
  code: "age" | "players" | "space" | "equipment";
  params: Record<string, string | number>;
}

/** Why a practice does not fit the squad, or an empty list when it does. */
export function ineligibleReasons(p: Practice, meta: SessionMeta): Reason[] {
  const out: Reason[] = [];
  if (!p.ageGroups.includes(meta.ageGroup)) out.push({ code: "age", params: { age: meta.ageGroup } });
  if (meta.playerCount < p.minPlayers || meta.playerCount > p.maxPlayers) {
    out.push({ code: "players", params: { min: p.minPlayers, max: p.maxPlayers } });
  }
  if (!areaFits(p.area, meta.space)) out.push({ code: "space", params: { l: p.area.lengthM, w: p.area.widthM } });
  const owned = new Set<Equipment>(meta.equipment);
  const missing = p.equipment.filter((e) => !owned.has(e));
  if (missing.length) out.push({ code: "equipment", params: { items: missing.join(",") } });
  return out;
}

export function fitsSquad(p: Practice, meta: SessionMeta): boolean {
  return ineligibleReasons(p, meta).length === 0;
}

/** Server-side pre-filter applied before anything reaches the model. */
export function filterEligible(practices: Practice[], meta: SessionMeta): Practice[] {
  return practices.filter((p) => fitsSquad(p, meta));
}

/** Theme match first, then id, for a stable and relevant order. */
export function rankByTheme(practices: Practice[], theme: Theme): Practice[] {
  return [...practices].sort((a, b) => {
    const ma = a.themes.includes(theme) ? 0 : 1;
    const mb = b.themes.includes(theme) ? 0 : 1;
    return ma - mb || a.id.localeCompare(b.id);
  });
}
