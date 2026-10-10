import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewPractice, PracticePatch, PracticeRow, Profile, SessionRow, ShareRow, Store } from "./types";

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T | null {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/**
 * Supabase-backed store.
 * `user` is a client acting as the signed-in user, so Row Level Security enforces ownership.
 * `admin` (service role) is used only where RLS must be bypassed: public share reads, view counts and reports.
 */
export function createSupabaseStore(user: SupabaseClient, admin: SupabaseClient): Store {
  return {
    async getProfile(id) {
      const r = await user.from("profiles").select("id, language, default_age_group").eq("id", id).maybeSingle();
      return check(r, "getProfile") as Profile | null;
    },
    async upsertProfile(p) {
      check(await user.from("profiles").upsert({ id: p.id, language: p.language, default_age_group: p.default_age_group }), "upsertProfile");
    },

    async listPractices(owner) {
      const r = await user.from("practices").select("*").eq("owner", owner).is("deleted_at", null).order("created_at", { ascending: false });
      return (check(r, "listPractices") ?? []) as PracticeRow[];
    },
    async getPractice(owner, id) {
      const r = await user.from("practices").select("*").eq("owner", owner).eq("id", id).is("deleted_at", null).maybeSingle();
      return check(r, "getPractice") as PracticeRow | null;
    },
    async countPractices(owner) {
      const r = await user.from("practices").select("id", { count: "exact", head: true }).eq("owner", owner).is("deleted_at", null);
      if (r.error) throw new Error(`countPractices: ${r.error.message}`);
      return r.count ?? 0;
    },
    async insertPractice(row: NewPractice) {
      const r = await user.from("practices").insert(row).select("*").single();
      return check(r, "insertPractice") as PracticeRow;
    },
    async updatePractice(owner, id, patch: PracticePatch) {
      const r = await user.from("practices").update(patch).eq("owner", owner).eq("id", id).is("deleted_at", null).select("*").maybeSingle();
      return check(r, "updatePractice") as PracticeRow | null;
    },
    async deletePractice(owner, id) {
      const r = await user
        .from("practices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("owner", owner)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id");
      return (check(r, "deletePractice") ?? []).length > 0;
    },

    async listSessions(owner, limit) {
      const r = await user.from("sessions").select("*").eq("owner", owner).order("created_at", { ascending: false }).limit(limit);
      return (check(r, "listSessions") ?? []) as SessionRow[];
    },
    async getSession(owner, id) {
      const r = await user.from("sessions").select("*").eq("owner", owner).eq("id", id).maybeSingle();
      return check(r, "getSession") as SessionRow | null;
    },
    async upsertSession(row) {
      const r = await user.from("sessions").upsert(row).select("*").single();
      return check(r, "upsertSession") as SessionRow;
    },

    async createShare(row) {
      const r = await user.from("shared_practices").insert(row).select("*").single();
      return check(r, "createShare") as ShareRow;
    },
    async getShare(id) {
      const r = await admin.from("shared_practices").select("*").eq("id", id).maybeSingle();
      return check(r, "getShare") as ShareRow | null;
    },
    async findActiveShare(owner, practiceId) {
      const r = await user
        .from("shared_practices")
        .select("*")
        .eq("owner", owner)
        .eq("practice_id", practiceId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return check(r, "findActiveShare") as ShareRow | null;
    },
    async updateShareSnapshot(owner, id, snapshot) {
      const r = await user
        .from("shared_practices")
        .update({ snapshot })
        .eq("owner", owner)
        .eq("id", id)
        .is("revoked_at", null)
        .select("*")
        .maybeSingle();
      return check(r, "updateShareSnapshot") as ShareRow | null;
    },
    async revokeShare(owner, id) {
      const r = await user
        .from("shared_practices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("owner", owner)
        .eq("id", id)
        .is("revoked_at", null)
        .select("id");
      return (check(r, "revokeShare") ?? []).length > 0;
    },
    async incrementViews(id) {
      const r = await admin.rpc("increment_share_views", { share_id: id });
      if (r.error) throw new Error(`incrementViews: ${r.error.message}`);
    },
    async countSharesSince(owner, sinceIso) {
      const r = await user
        .from("shared_practices")
        .select("id", { count: "exact", head: true })
        .eq("owner", owner)
        .gte("created_at", sinceIso);
      if (r.error) throw new Error(`countSharesSince: ${r.error.message}`);
      return r.count ?? 0;
    },

    async logGeneration(row) {
      // The service role writes the log, so a user can never edit or hide their own generations.
      check(await admin.from("generations").insert(row), "logGeneration");
    },
    async countGenerationsSince(owner, sinceIso) {
      const r = await admin.from("generations").select("id", { count: "exact", head: true }).eq("owner", owner).gte("created_at", sinceIso);
      if (r.error) throw new Error(`countGenerationsSince: ${r.error.message}`);
      return r.count ?? 0;
    },

    async addReport(sharedId, reason) {
      check(await admin.from("reports").insert({ shared_id: sharedId, reason }), "addReport");
    },
  };
}
