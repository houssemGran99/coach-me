import "server-only";
import { isReviewed, type Practice } from "@mourabbi/schemas";
import { getTemplates } from "../templates";
import { getConfig } from "./config";
import type { Store } from "./store/types";

export interface PracticePool {
  all: Practice[];
  lookup: (id: string) => Practice | undefined;
  libraryIds: Set<string>;
}

/**
 * Practices a user may use in a generated session: the owner's saved practices, plus
 * templates that a named coach reviewed (and, until any are reviewed, pending templates when
 * ALLOW_PENDING_TEMPLATES is on, which is the default). Never someone else's practices.
 */
export async function loadPool(store: Store, owner: string): Promise<PracticePool> {
  const cfg = getConfig();
  const templates = getTemplates().filter((t) => isReviewed(t) || cfg.allowPendingTemplates);
  const mine = (await store.listPractices(owner)).map((r) => ({ ...r.data, id: r.id }));
  const all = [...templates, ...mine];
  const byId = new Map(all.map((p) => [p.id, p]));
  return { all, lookup: (id) => byId.get(id), libraryIds: new Set(mine.map((p) => p.id)) };
}
