import { afterEach, describe, expect, it } from "vitest";
import { activeShare, allowReport, buildSnapshot, practiceFromShare, readPublicShare, shareLink } from "./share";
import { saveSharedCopy, saveTemplateCopy } from "./library";
import { applyLibraryEdit } from "./library";
import { createMemoryStore } from "./store/memory";
import { getTemplate } from "../templates";

const OWNER = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

async function libraryPractice(store: ReturnType<typeof createMemoryStore>) {
  const r = await saveTemplateCopy(store, OWNER, "rondo_4v2_u10", "en");
  if (!r.ok) throw new Error("save failed");
  await store.updatePractice(OWNER, r.row.id, { notes: "PRIVATE NOTE about Ahmed, age 11" });
  return r.row;
}

describe("share snapshot", () => {
  it("contains no coach notes, owner id, email or session context", async () => {
    const store = createMemoryStore();
    const row = await libraryPractice(store);
    const res = await shareLink(store, OWNER, row.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const stored = (await store.getShare(res.id))!;
    const text = JSON.stringify(stored.snapshot);
    expect(text).not.toContain("PRIVATE NOTE");
    expect(text).not.toContain("Ahmed");
    expect(text).not.toContain(OWNER);
    expect(text).not.toContain("@");
    expect(stored.snapshot.id).toBe(res.id); // the library id is not exposed
    expect(text).not.toContain(row.id);
    expect(Object.keys(stored.snapshot).sort()).toEqual(Object.keys(getTemplate("rondo_4v2_u10")!).sort());
  });

  it("is built through the strict schema, so extra fields cannot ride along", () => {
    const p = { ...getTemplate("rondo_4v2_u10")!, notes: "secret", owner: OWNER } as never;
    expect(() => buildSnapshot(p, "abcdefghijklmnop")).toThrow();
  });

  it("generates long, unguessable ids", async () => {
    const store = createMemoryStore();
    const a = await shareLink(store, OWNER, "rondo_4v2_u10");
    const b = await shareLink(store, OWNER, "dynamic_warmup_ball");
    expect(a.ok && a.id.length).toBeGreaterThanOrEqual(12);
    expect(a.ok && b.ok && a.id !== b.id).toBe(true);
  });
});

describe("public read", () => {
  it("returns the snapshot without any login and counts the view", async () => {
    const store = createMemoryStore();
    const res = await shareLink(store, OWNER, "rondo_4v2_u10");
    if (!res.ok) throw new Error();
    const p = await readPublicShare(store, res.id);
    expect(p?.name.en).toBe("4v2 rondo");
    expect((await store.getShare(res.id))!.views).toBe(1);
  });

  it("gives the same answer for unknown and revoked ids", async () => {
    const store = createMemoryStore();
    const res = await shareLink(store, OWNER, "rondo_4v2_u10");
    if (!res.ok) throw new Error();
    expect(await store.revokeShare(OWNER, res.id)).toBe(true);
    const revoked = await readPublicShare(store, res.id);
    const unknown = await readPublicShare(store, "doesnotexist123456");
    const malformed = await readPublicShare(store, "../etc/passwd");
    expect(revoked).toBeNull();
    expect(unknown).toBeNull();
    expect(malformed).toBeNull();
  });

  it("only the owner can stop sharing", async () => {
    const store = createMemoryStore();
    const res = await shareLink(store, OWNER, "rondo_4v2_u10");
    if (!res.ok) throw new Error();
    expect(await store.revokeShare(OTHER, res.id)).toBe(false);
    expect(await readPublicShare(store, res.id)).not.toBeNull();
    expect(await store.revokeShare(OWNER, res.id)).toBe(true);
    expect(await readPublicShare(store, res.id)).toBeNull();
  });

  it("shows an AI draft as an AI draft", async () => {
    const store = createMemoryStore();
    const ai = { ...getTemplate("rondo_4v2_u10")!, source: "ai", review: { status: "ai_draft", reviewedBy: null, reviewedAt: null } };
    const { saveDraft } = await import("./library");
    const saved = await saveDraft(store, OWNER, ai, "en", null);
    if (!saved.ok) throw new Error();
    const res = await shareLink(store, OWNER, saved.row.id);
    if (!res.ok) throw new Error();
    const p = (await readPublicShare(store, res.id))!;
    expect(p.review.status).toBe("ai_draft");
    expect(p.source).toBe("ai");
  });
});

describe("update link or new link", () => {
  it("refuses to silently create a second link, and says which one exists", async () => {
    const store = createMemoryStore();
    const first = await shareLink(store, OWNER, "rondo_4v2_u10");
    if (!first.ok) throw new Error();
    expect(await shareLink(store, OWNER, "rondo_4v2_u10")).toEqual({ ok: false, code: "ALREADY_SHARED", existingId: first.id });
    expect((await activeShare(store, OWNER, "rondo_4v2_u10"))?.id).toBe(first.id);
  });

  it("later edits do not change an existing link until the owner updates it", async () => {
    const store = createMemoryStore();
    const row = await libraryPractice(store);
    const first = await shareLink(store, OWNER, row.id);
    if (!first.ok) throw new Error();
    const edited = applyLibraryEdit(row.data, { title: "Renamed after sharing" }, "en")!;
    await store.updatePractice(OWNER, row.id, { data: edited, title: "Renamed after sharing" });
    expect((await readPublicShare(store, first.id))!.name.en).toBe("4v2 rondo");
    const upd = await shareLink(store, OWNER, row.id, "update");
    expect(upd).toEqual({ ok: true, id: first.id, updated: true });
    expect((await readPublicShare(store, first.id))!.name.en).toBe("Renamed after sharing");
  });

  it("'new' creates a separate link and leaves the old one working", async () => {
    const store = createMemoryStore();
    const first = await shareLink(store, OWNER, "rondo_4v2_u10");
    const second = await shareLink(store, OWNER, "rondo_4v2_u10", "new");
    if (!first.ok || !second.ok) throw new Error();
    expect(second.id).not.toBe(first.id);
    expect(await readPublicShare(store, first.id)).not.toBeNull();
    expect(await readPublicShare(store, second.id)).not.toBeNull();
  });

  it("cannot share something that is not yours or does not exist", async () => {
    const store = createMemoryStore();
    const row = await libraryPractice(store);
    expect(await shareLink(store, OTHER, row.id)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await shareLink(store, OWNER, "nope")).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("limits", () => {
  it("allows 30 new shares per user per day by default, and updates do not count", async () => {
    process.env.DAILY_SHARE_LIMIT = "2";
    const store = createMemoryStore();
    expect((await shareLink(store, OWNER, "rondo_4v2_u10")).ok).toBe(true);
    expect((await shareLink(store, OWNER, "dynamic_warmup_ball")).ok).toBe(true);
    expect(await shareLink(store, OWNER, "buildout_4v2_u14")).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect((await shareLink(store, OWNER, "rondo_4v2_u10", "update")).ok).toBe(true);
    expect((await shareLink(store, OTHER, "buildout_4v2_u14")).ok).toBe(true);
  });

  it("throttles report spam per client", () => {
    for (let i = 0; i < 10; i++) expect(allowReport("1.2.3.4", 1000 + i)).toBe(true);
    expect(allowReport("1.2.3.4", 2000)).toBe(false);
    expect(allowReport("5.6.7.8", 2000)).toBe(true);
    expect(allowReport("1.2.3.4", 1000 + 3_700_000)).toBe(true);
  });
});

describe("saving a shared practice", () => {
  it("copies the snapshot into the visitor's library and keeps AI content as an AI draft", async () => {
    const store = createMemoryStore();
    const res = await shareLink(store, OWNER, "rondo_4v2_u10");
    if (!res.ok) throw new Error();
    const saved = await saveSharedCopy(store, OTHER, res.id, "en");
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.row.owner).toBe(OTHER);
      expect(saved.row.data.review.status).toBe("pending");
      expect(saved.row.notes).toBe("");
    }
    // Revoked links can no longer be saved.
    await store.revokeShare(OWNER, res.id);
    expect(await saveSharedCopy(store, OTHER, res.id, "en")).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("practiceFromShare never upgrades the trust label", () => {
    const snap = { ...getTemplate("rondo_4v2_u10")!, source: "ai" as const, review: { status: "ai_draft" as const, reviewedBy: null, reviewedAt: null } };
    expect(practiceFromShare(snap).source).toBe("ai");
    expect(practiceFromShare(snap).review.status).toBe("ai_draft");
  });
});
