import "server-only";
import type { Store } from "./store/types";
import { getConfig } from "./config";

/** Start of the current UTC day, as an ISO string. */
export function startOfDayIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function generationQuota(store: Store, owner: string, now: Date = new Date()) {
  const limit = getConfig().dailyGenerationLimit;
  const used = await store.countGenerationsSince(owner, startOfDayIso(now));
  return { limit, used, allowed: used < limit };
}

export async function shareQuota(store: Store, owner: string, now: Date = new Date()) {
  const limit = getConfig().dailyShareLimit;
  const used = await store.countSharesSince(owner, startOfDayIso(now));
  return { limit, used, allowed: used < limit };
}
