import { afterEach, describe, expect, it } from "vitest";
import { trustLabel, type Practice } from "@mourabbi/schemas";
import { applyLibraryEdit, duplicatePractice, saveDraft, saveTemplateCopy } from "./library";
import { createMemoryStore } from "./store/memory";
import { filterLibrary, parseLibraryFilters, type LibraryItem } from "../library-filter";
import { getTemplate } from "../templates";

const OWNER = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("saving to the library", () => {
  it("copies a template with a new id, keeps the parent and the (pending) trust label", async () => {
    const store = createMemoryStore();
    const r = await saveTemplateCopy(store, OWNER, "rondo_4v2_u10", "fr");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.id).not.toBe("rondo_4v2_u10");
    expect(r.row.data.id).toBe(r.row.id);
    expect(r.row.parent_template_id).toBe("rondo_4v2_u10");
    expect(r.row.title).toBe("Rondo 4 contre 2");
    expect(trustLabel(r.row.data)).toBe("pending");
  });

  it("is a snapshot: changing the template later never changes the copy", async () => {
    const store = createMemoryStore();
    const r = await saveTemplateCopy(store, OWNER, "rondo_4v2_u10", "en");
    if (!r.ok) throw new Error("save failed");
    const tpl = getTemplate("rondo_4v2_u10")!;
    tpl.organisation.en = "CHANGED IN TEMPLATE";
    const again = await store.getPractice(OWNER, r.row.id);
    expect(again!.data.organisation.en).not.toBe("CHANGED IN TEMPLATE");
    tpl.organisation.en = r.row.data.organisation.en; // restore the shared cache
  });

  it("enforces the free-tier cap and reports it", async () => {
    process.env.FREE_LIBRARY_LIMIT = "2";
    const store = createMemoryStore();
    expect((await saveTemplateCopy(store, OWNER, "rondo_4v2_u10", "en")).ok).toBe(true);
    expect((await saveTemplateCopy(store, OWNER, "dynamic_warmup_ball", "en")).ok).toBe(true);
    expect(await saveTemplateCopy(store, OWNER, "buildout_4v2_u14", "en")).toEqual({ ok: false, code: "LIBRARY_FULL" });
    // The cap is per user.
    expect((await saveTemplateCopy(store, OTHER, "buildout_4v2_u14", "en")).ok).toBe(true);
    // Deleting frees a slot.
    const [first] = await store.listPractices(OWNER);
    await store.deletePractice(OWNER, first!.id);
    expect((await saveTemplateCopy(store, OWNER, "buildout_4v2_u14", "en")).ok).toBe(true);
    // Duplicates count too.
    const [one] = await store.listPractices(OWNER);
    expect(await duplicatePractice(store, OWNER, one!.id, "(copy)")).toEqual({ ok: false, code: "LIBRARY_FULL" });
  });

  it("unknown templates are not found", async () => {
    expect(await saveTemplateCopy(createMemoryStore(), OWNER, "nope", "en")).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("saves a chat draft only as an AI draft, even if the client claims it is reviewed", async () => {
    const store = createMemoryStore();
    const claimed = { ...getTemplate("rondo_4v2_u10")!, source: "user", review: { status: "reviewed", reviewedBy: "Coach A", reviewedAt: "2026-01-01" } };
    const r = await saveDraft(store, OWNER, claimed, "en", null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.source).toBe("ai");
      expect(r.row.review_status).toBe("ai_draft");
      expect(r.row.data.review).toEqual({ status: "ai_draft", reviewedBy: null, reviewedAt: null });
    }
  });

  it("rejects drafts that break the schema or the animation rules", async () => {
    const store = createMemoryStore();
    const bad = structuredClone(getTemplate("rondo_4v2_u10")!);
    bad.animation.actors[0]!.x = 500;
    expect(await saveDraft(store, OWNER, bad, "en", null)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await saveDraft(store, OWNER, { nonsense: true }, "en", null)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it("duplicates with the same trust label and copies private notes only for the same owner", async () => {
    const store = createMemoryStore();
    const r = await saveTemplateCopy(store, OWNER, "rondo_4v2_u10", "en");
    if (!r.ok) throw new Error();
    await store.updatePractice(OWNER, r.row.id, { notes: "private" });
    const d = await duplicatePractice(store, OWNER, r.row.id, "(copy)");
    expect(d.ok && d.row.title).toBe("4v2 rondo (copy)");
    expect(d.ok && d.row.notes).toBe("private");
    expect(d.ok && d.row.id).not.toBe(r.row.id);
    // Another user cannot duplicate it.
    expect(await duplicatePractice(store, OTHER, r.row.id, "(copy)")).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("owner edits", () => {
  const copy = (): Practice => ({ ...structuredClone(getTemplate("rondo_4v2_u10")!), source: "user" });

  it("editing the title or set-up makes it edited_by_owner and keeps movement untouched", () => {
    const p = copy();
    const out = applyLibraryEdit(p, { title: "My rondo", organisation: "Four on two, my way." }, "en")!;
    expect(out.review.status).toBe("edited_by_owner");
    expect(out.name.en).toBe("My rondo");
    expect(out.organisation.en).toBe("Four on two, my way.");
    expect(out.name.fr).toBe(p.name.fr);
    expect(out.animation).toEqual(p.animation);
  });

  it("an edit drops a 'reviewed' label because the content is no longer what the coach reviewed", () => {
    const p = copy();
    p.review = { status: "reviewed", reviewedBy: "Coach A", reviewedAt: "2026-01-01" };
    const out = applyLibraryEdit(p, { title: "Changed" }, "en")!;
    expect(trustLabel(out)).toBe("edited_by_owner");
    expect(out.review.reviewedBy).toBeNull();
  });

  it("confirming an AI draft marks it as the owner's", () => {
    const p = copy();
    p.source = "ai";
    p.review = { status: "ai_draft", reviewedBy: null, reviewedAt: null };
    expect(trustLabel(p)).toBe("ai_draft");
    expect(trustLabel(applyLibraryEdit(p, { confirmDraft: true }, "en")!)).toBe("edited_by_owner");
  });

  it("rejects an edit that breaks the limits", () => {
    expect(applyLibraryEdit(copy(), { organisation: "x".repeat(601) }, "en")).toBeNull();
  });
});

describe("library search, filter and sort", () => {
  const mk = (id: string, title: string, created: string, source: LibraryItem["source"], tplId: string): LibraryItem => ({
    id, title, source, created_at: created, data: { ...structuredClone(getTemplate(tplId)!), id },
  });
  const items = [
    mk("a", "Zebra rondo", "2026-01-01T00:00:00Z", "user", "rondo_4v2_u10"),
    mk("b", "Alpha warm-up", "2026-03-01T00:00:00Z", "template", "dynamic_warmup_ball"),
    mk("c", "Mid game", "2026-02-01T00:00:00Z", "ai", "small_sided_game_5v5"),
  ];
  const run = (q: Record<string, string>) => filterLibrary(items, parseLibraryFilters(q)).map((i) => i.id);

  it("sorts newest first by default and by name on request", () => {
    expect(run({})).toEqual(["b", "c", "a"]);
    expect(run({ sort: "name" })).toEqual(["b", "c", "a"].sort((x, y) => items.find((i) => i.id === x)!.title.localeCompare(items.find((i) => i.id === y)!.title)));
  });
  it("searches the owner's title", () => expect(run({ q: "zebra" })).toEqual(["a"]));
  it("filters by source, age group and player count", () => {
    expect(run({ source: "ai" })).toEqual(["c"]);
    expect(run({ age: "U10" })).toEqual(["b", "c", "a"]);
    expect(run({ age: "U6" })).toEqual([]);
    expect(run({ players: "30" })).toEqual(["b"]);
  });
});
