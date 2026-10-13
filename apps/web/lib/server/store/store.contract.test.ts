import { afterAll, describe, expect, it } from "vitest";
import { getTemplate } from "@/lib/templates";
import { createMemoryStore } from "./memory";
import { connectMongo, createMongoStore } from "./mongo";
import type { NewPractice, Store } from "./types";

/**
 * The same behaviour is required of every store. The MongoDB run needs a real database:
 * MONGODB_URI_TEST=mongodb://... pnpm test (a throwaway database named coach_test_<random> is used and dropped).
 */
const mongoUri = process.env.MONGODB_URI_TEST;
const dbName = `coach_test_${Math.random().toString(36).slice(2, 10)}`;

const stores: [string, () => Store][] = [["memory", () => createMemoryStore()]];
if (mongoUri) stores.push(["mongodb", () => createMongoStore(connectMongo(mongoUri, dbName))]);

afterAll(async () => {
  if (mongoUri) await (await connectMongo(mongoUri, dbName)).dropDatabase();
});

const uid = () => crypto.randomUUID();

describe.each(stores)("store contract: %s", (_name, make) => {
  const base = () => {
    const t = getTemplate("rondo_4v2_u10")!;
    return (owner: string): NewPractice => ({
      id: uid(), owner, title: "Mine", data: t, source: "user", review_status: "pending", parent_template_id: t.id, notes: "",
    });
  };

  it("keeps practices private to their owner and soft-deletes", async () => {
    const s = make();
    const [a, b] = [uid(), uid()];
    const row = await s.insertPractice(base()(a));
    expect((await s.listPractices(a)).map((p) => p.id)).toEqual([row.id]);
    expect(await s.listPractices(b)).toEqual([]);
    expect(await s.getPractice(b, row.id)).toBeNull();
    expect(await s.updatePractice(b, row.id, { title: "Hacked" })).toBeNull();
    expect((await s.updatePractice(a, row.id, { title: "Renamed", notes: "n" }))?.title).toBe("Renamed");
    expect(await s.countPractices(a)).toBe(1);
    expect(await s.deletePractice(b, row.id)).toBe(false);
    expect(await s.deletePractice(a, row.id)).toBe(true);
    expect(await s.getPractice(a, row.id)).toBeNull();
    expect(await s.countPractices(a)).toBe(0);
  });

  it("stores sessions per owner and refuses to take over another owner's id", async () => {
    const s = make();
    const [a, b] = [uid(), uid()];
    const id = uid();
    const data = { id, title: "S" } as never;
    const first = await s.upsertSession({ id, owner: a, data, reflection: null });
    const again = await s.upsertSession({ id, owner: a, data, reflection: null });
    expect(again.created_at).toBe(first.created_at);
    await expect(s.upsertSession({ id, owner: b, data, reflection: null })).rejects.toThrow();
    expect(await s.getSession(b, id)).toBeNull();
    expect((await s.listSessions(a, 10)).length).toBe(1);
    expect(await s.listSessions(b, 10)).toEqual([]);
  });

  it("runs the share lifecycle: create, find, update, count views, revoke", async () => {
    const s = make();
    const [a, b] = [uid(), uid()];
    const snapshot = getTemplate("rondo_4v2_u10")!;
    const id = uid();
    await s.createShare({ id, owner: a, practice_id: "p1", snapshot });
    expect((await s.findActiveShare(a, "p1"))?.id).toBe(id);
    expect(await s.findActiveShare(b, "p1")).toBeNull();
    expect(await s.updateShareSnapshot(b, id, snapshot)).toBeNull();
    expect(await s.updateShareSnapshot(a, id, snapshot)).not.toBeNull();
    await s.incrementViews(id);
    await s.incrementViews(id);
    expect((await s.getShare(id))?.views).toBe(2);
    expect(await s.countSharesSince(a, "2000-01-01T00:00:00.000Z")).toBe(1);
    expect(await s.countSharesSince(a, "2999-01-01T00:00:00.000Z")).toBe(0);
    expect(await s.revokeShare(b, id)).toBe(false);
    expect(await s.revokeShare(a, id)).toBe(true);
    expect((await s.getShare(id))?.revoked_at).not.toBeNull();
    expect(await s.findActiveShare(a, "p1")).toBeNull();
    expect(await s.getShare("missing")).toBeNull();
  });

  it("keeps profiles, generation counts and reports", async () => {
    const s = make();
    const a = uid();
    expect(await s.getProfile(a)).toBeNull();
    await s.upsertProfile({ id: a, language: "fr", default_age_group: "U12" });
    await s.upsertProfile({ id: a, language: "ar", default_age_group: null });
    expect(await s.getProfile(a)).toEqual({ id: a, language: "ar", default_age_group: null });
    await s.logGeneration({ owner: a, kind: "session", input: {}, output: {}, valid: true, retries: 0 });
    expect(await s.countGenerationsSince(a, "2000-01-01T00:00:00.000Z")).toBe(1);
    expect(await s.countGenerationsSince(uid(), "2000-01-01T00:00:00.000Z")).toBe(0);
    await expect(s.addReport("x", null)).resolves.toBeUndefined();
  });
});
