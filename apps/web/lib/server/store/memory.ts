import type { Practice } from "@mourabbi/schemas";
import type {
  GenerationLog, NewPractice, PracticePatch, PracticeRow, Profile, SessionRow, ShareRow, Store,
} from "./types";

interface State {
  profiles: Map<string, Profile>;
  practices: Map<string, PracticeRow>;
  sessions: Map<string, SessionRow>;
  shares: Map<string, ShareRow>;
  generations: (GenerationLog & { created_at: string })[];
  reports: { shared_id: string; reason: string | null; created_at: string }[];
}

const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => structuredClone(v);

export function createMemoryState(): State {
  return { profiles: new Map(), practices: new Map(), sessions: new Map(), shares: new Map(), generations: [], reports: [] };
}

/** In-memory store: development and end-to-end tests only. Mirrors the Row Level Security rules (owner-only access). */
export function createMemoryStore(state: State = createMemoryState()): Store & { state: State } {
  return {
    state,
    async getProfile(id) {
      return clone(state.profiles.get(id) ?? null);
    },
    async upsertProfile(p) {
      state.profiles.set(p.id, clone(p));
    },

    async listPractices(owner) {
      return [...state.practices.values()]
        .filter((p) => p.owner === owner && !p.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(clone);
    },
    async getPractice(owner, id) {
      const p = state.practices.get(id);
      return p && p.owner === owner && !p.deleted_at ? clone(p) : null;
    },
    async countPractices(owner) {
      return [...state.practices.values()].filter((p) => p.owner === owner && !p.deleted_at).length;
    },
    async insertPractice(row: NewPractice) {
      const t = now();
      const full: PracticeRow = { ...clone(row), created_at: t, updated_at: t, deleted_at: null };
      state.practices.set(full.id, full);
      return clone(full);
    },
    async updatePractice(owner, id, patch: PracticePatch) {
      const p = state.practices.get(id);
      if (!p || p.owner !== owner || p.deleted_at) return null;
      Object.assign(p, clone(patch), { updated_at: now() });
      return clone(p);
    },
    async deletePractice(owner, id) {
      const p = state.practices.get(id);
      if (!p || p.owner !== owner || p.deleted_at) return false;
      p.deleted_at = now();
      return true;
    },

    async listSessions(owner, limit) {
      return [...state.sessions.values()]
        .filter((s) => s.owner === owner)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(clone);
    },
    async getSession(owner, id) {
      const s = state.sessions.get(id);
      return s && s.owner === owner ? clone(s) : null;
    },
    async upsertSession(row) {
      const existing = state.sessions.get(row.id);
      if (existing && existing.owner !== row.owner) throw new Error("forbidden");
      const t = now();
      const full: SessionRow = { ...clone(row), created_at: existing?.created_at ?? t, updated_at: t };
      state.sessions.set(full.id, full);
      return clone(full);
    },

    async createShare(row) {
      const full: ShareRow = { ...clone(row), created_at: now(), revoked_at: null, views: 0 };
      state.shares.set(full.id, full);
      return clone(full);
    },
    async getShare(id) {
      return clone(state.shares.get(id) ?? null);
    },
    async findActiveShare(owner, practiceId) {
      const found = [...state.shares.values()]
        .filter((s) => s.owner === owner && s.practice_id === practiceId && !s.revoked_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return clone(found ?? null);
    },
    async updateShareSnapshot(owner, id, snapshot: Practice) {
      const s = state.shares.get(id);
      if (!s || s.owner !== owner || s.revoked_at) return null;
      s.snapshot = clone(snapshot);
      return clone(s);
    },
    async revokeShare(owner, id) {
      const s = state.shares.get(id);
      if (!s || s.owner !== owner || s.revoked_at) return false;
      s.revoked_at = now();
      return true;
    },
    async incrementViews(id) {
      const s = state.shares.get(id);
      if (s) s.views += 1;
    },
    async countSharesSince(owner, sinceIso) {
      return [...state.shares.values()].filter((s) => s.owner === owner && s.created_at >= sinceIso).length;
    },

    async logGeneration(row) {
      state.generations.push({ ...clone(row), created_at: now() });
    },
    async countGenerationsSince(owner, sinceIso) {
      return state.generations.filter((g) => g.owner === owner && g.created_at >= sinceIso).length;
    },

    async addReport(sharedId, reason) {
      state.reports.push({ shared_id: sharedId, reason, created_at: now() });
    },
  };
}
