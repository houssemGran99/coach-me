import type { Practice, Source } from "@mourabbi/schemas";
import { filterPractices, parseFilters, type TemplateFilters } from "./templates";

export interface LibraryItem {
  id: string;
  title: string;
  data: Practice;
  source: Source;
  created_at: string;
}

export interface LibraryFilters extends TemplateFilters {
  source?: Source;
  sort: "newest" | "name";
  view: "list" | "grid";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseLibraryFilters(params: Params): LibraryFilters {
  const src = one(params.source);
  return {
    ...parseFilters(params),
    source: src === "template" || src === "ai" || src === "user" ? src : undefined,
    sort: one(params.sort) === "name" ? "name" : "newest",
    view: one(params.view) === "grid" ? "grid" : "list",
  };
}

/** Search the owner's title and all names; the other filters are shared with the template gallery. */
export function filterLibrary(items: LibraryItem[], f: LibraryFilters): LibraryItem[] {
  const { q, ...rest } = f;
  const ok = new Set(filterPractices(items.map((i) => i.data), rest).map((p) => p.id));
  const words = q ? norm(q.trim()).split(/\s+/).filter(Boolean) : [];
  const out = items.filter((i) => {
    if (!ok.has(i.data.id)) return false;
    if (f.source && i.source !== f.source) return false;
    if (!words.length) return true;
    const hay = norm([i.title, i.data.name.fr, i.data.name.en, i.data.name.de, i.data.organisation.fr, i.data.organisation.en].join(" "));
    return words.every((w) => hay.includes(w));
  });
  return out.sort((a, b) =>
    f.sort === "name" ? a.title.localeCompare(b.title) : b.created_at.localeCompare(a.created_at),
  );
}
