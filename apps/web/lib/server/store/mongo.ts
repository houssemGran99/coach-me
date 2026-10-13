import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import type { Practice } from "@mourabbi/schemas";
import type {
  GenerationLog, NewPractice, PracticePatch, PracticeRow, Profile, SessionRow, ShareRow, Store,
} from "./types";

const now = () => new Date().toISOString();

/** Documents use the row id as `_id`; rows use `id`. */
function toRow<T>(doc: Document | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as T;
}
function toDoc(row: { id: string } & Record<string, unknown>): Document {
  const { id, ...rest } = row;
  return { _id: id, ...rest } as Document;
}

type G = typeof globalThis & { __coachMongo?: Map<string, Promise<Db>> };

/** One connection per server instance, reused across requests and hot reloads. */
export function connectMongo(uri: string, dbName: string): Promise<Db> {
  const g = globalThis as G;
  g.__coachMongo ??= new Map();
  const key = `${uri}|${dbName}`;
  let db = g.__coachMongo.get(key);
  if (!db) {
    db = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
      .connect()
      .then(async (client) => {
        const d = client.db(dbName);
        await Promise.all([
          d.collection("practices").createIndex({ owner: 1, created_at: -1 }),
          d.collection("sessions").createIndex({ owner: 1, created_at: -1 }),
          d.collection("shares").createIndex({ owner: 1, practice_id: 1 }),
          d.collection("shares").createIndex({ owner: 1, created_at: 1 }),
          d.collection("generations").createIndex({ owner: 1, created_at: 1 }),
        ]);
        return d;
      });
    // A failed connect must not be cached forever.
    db.catch(() => g.__coachMongo?.delete(key));
    g.__coachMongo.set(key, db);
  }
  return db;
}

/**
 * MongoDB store. Row Level Security does not exist here, so every query that touches user data filters
 * on `owner` in code; the only unfiltered read is `getShare`, which backs the public share page.
 */
export function createMongoStore(dbPromise: Promise<Db>): Store {
  const col = async (name: string): Promise<Collection<Document>> => (await dbPromise).collection(name);

  return {
    async getProfile(userId) {
      return toRow<Profile>(await (await col("profiles")).findOne({ _id: userId as never }));
    },
    async upsertProfile(p) {
      await (await col("profiles")).replaceOne({ _id: p.id as never }, toDoc({ ...p }), { upsert: true });
    },

    async listPractices(owner) {
      const docs = await (await col("practices")).find({ owner, deleted_at: null }).sort({ created_at: -1 }).toArray();
      return docs.map((d) => toRow<PracticeRow>(d)!);
    },
    async getPractice(owner, id) {
      return toRow<PracticeRow>(await (await col("practices")).findOne({ _id: id as never, owner, deleted_at: null }));
    },
    async countPractices(owner) {
      return (await col("practices")).countDocuments({ owner, deleted_at: null });
    },
    async insertPractice(row: NewPractice) {
      const t = now();
      const full = { ...row, created_at: t, updated_at: t, deleted_at: null };
      await (await col("practices")).insertOne(toDoc(full));
      return full as PracticeRow;
    },
    async updatePractice(owner, id, patch: PracticePatch) {
      const doc = await (await col("practices")).findOneAndUpdate(
        { _id: id as never, owner, deleted_at: null },
        { $set: { ...patch, updated_at: now() } },
        { returnDocument: "after" },
      );
      return toRow<PracticeRow>(doc);
    },
    async deletePractice(owner, id) {
      const r = await (await col("practices")).updateOne({ _id: id as never, owner, deleted_at: null }, { $set: { deleted_at: now() } });
      return r.modifiedCount > 0;
    },

    async listSessions(owner, limit) {
      const docs = await (await col("sessions")).find({ owner }).sort({ created_at: -1 }).limit(limit).toArray();
      return docs.map((d) => toRow<SessionRow>(d)!);
    },
    async getSession(owner, id) {
      return toRow<SessionRow>(await (await col("sessions")).findOne({ _id: id as never, owner }));
    },
    async upsertSession(row) {
      const t = now();
      try {
        const doc = await (await col("sessions")).findOneAndUpdate(
          { _id: row.id as never, owner: row.owner },
          { $set: { data: row.data, reflection: row.reflection, updated_at: t }, $setOnInsert: { owner: row.owner, created_at: t } },
          { upsert: true, returnDocument: "after" },
        );
        return toRow<SessionRow>(doc)!;
      } catch (e) {
        // The id exists under another owner: the upsert tried to insert a duplicate _id.
        if ((e as { code?: number }).code === 11000) throw new Error("forbidden");
        throw e;
      }
    },

    async createShare(row) {
      const full = { ...row, created_at: now(), revoked_at: null, views: 0 };
      await (await col("shares")).insertOne(toDoc(full));
      return full as ShareRow;
    },
    async getShare(id) {
      return toRow<ShareRow>(await (await col("shares")).findOne({ _id: id as never }));
    },
    async findActiveShare(owner, practiceId) {
      const [doc] = await (await col("shares"))
        .find({ owner, practice_id: practiceId, revoked_at: null })
        .sort({ created_at: -1 })
        .limit(1)
        .toArray();
      return toRow<ShareRow>(doc ?? null);
    },
    async updateShareSnapshot(owner, id, snapshot: Practice) {
      const doc = await (await col("shares")).findOneAndUpdate(
        { _id: id as never, owner, revoked_at: null },
        { $set: { snapshot } },
        { returnDocument: "after" },
      );
      return toRow<ShareRow>(doc);
    },
    async revokeShare(owner, id) {
      const r = await (await col("shares")).updateOne({ _id: id as never, owner, revoked_at: null }, { $set: { revoked_at: now() } });
      return r.modifiedCount > 0;
    },
    async incrementViews(id) {
      await (await col("shares")).updateOne({ _id: id as never }, { $inc: { views: 1 } });
    },
    async countSharesSince(owner, sinceIso) {
      return (await col("shares")).countDocuments({ owner, created_at: { $gte: sinceIso } });
    },

    async logGeneration(row: GenerationLog) {
      await (await col("generations")).insertOne({ ...row, created_at: now() });
    },
    async countGenerationsSince(owner, sinceIso) {
      return (await col("generations")).countDocuments({ owner, created_at: { $gte: sinceIso } });
    },

    async addReport(sharedId, reason) {
      await (await col("reports")).insertOne({ shared_id: sharedId, reason, created_at: now() });
    },
  };
}
