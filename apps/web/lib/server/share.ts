import "server-only";
import { nanoid } from "nanoid";
import { PracticeSchema, type Practice } from "@mourabbi/schemas";
import { getTemplate } from "../templates";
import { shareQuota } from "./limits";
import type { ShareRow, Store } from "./store/types";

export const SHARE_ID = /^[A-Za-z0-9_-]{12,64}$/;
const SHARE_ID_LENGTH = 16;

/**
 * The public copy of a practice. Built field by field from the strict Practice schema, so nothing
 * else can ride along: no coach notes, no owner id or email, no session context, no source note.
 * The id is replaced by the share id so the owner's library id is not exposed either.
 */
export function buildSnapshot(practice: Practice, shareId: string): Practice {
  return PracticeSchema.parse({ ...practice, id: shareId });
}

export type ShareSource = { kind: "library" | "template"; id: string };

async function resolveSource(store: Store, owner: string, id: string): Promise<{ practice: Practice; source: ShareSource } | null> {
  const mine = await store.getPractice(owner, id);
  if (mine) return { practice: mine.data, source: { kind: "library", id } };
  const tpl = getTemplate(id);
  return tpl ? { practice: tpl, source: { kind: "template", id } } : null;
}

export type ShareResult =
  | { ok: true; id: string; updated?: boolean }
  | { ok: false; code: "NOT_FOUND" | "RATE_LIMITED" | "ALREADY_SHARED"; existingId?: string };

/**
 * Create, update or replace a share link.
 * - no mode: refuses with ALREADY_SHARED (and the existing id) if the practice already has a live link
 * - "update": keeps the link, replaces the snapshot with the current version
 * - "new": makes a separate link and leaves the old one as it is
 */
export async function shareLink(store: Store, owner: string, practiceId: string, mode?: "update" | "new"): Promise<ShareResult> {
  const src = await resolveSource(store, owner, practiceId);
  if (!src) return { ok: false, code: "NOT_FOUND" };
  const existing = await store.findActiveShare(owner, practiceId);

  if (existing && mode === undefined) return { ok: false, code: "ALREADY_SHARED", existingId: existing.id };
  if (existing && mode === "update") {
    const updated = await store.updateShareSnapshot(owner, existing.id, buildSnapshot(src.practice, existing.id));
    return updated ? { ok: true, id: existing.id, updated: true } : { ok: false, code: "NOT_FOUND" };
  }

  if (!(await shareQuota(store, owner)).allowed) return { ok: false, code: "RATE_LIMITED" };
  const id = nanoid(SHARE_ID_LENGTH);
  await store.createShare({ id, owner, practice_id: practiceId, snapshot: buildSnapshot(src.practice, id) });
  return { ok: true, id };
}

/** The live link of a practice, if any (for the share dialog). */
export async function activeShare(store: Store, owner: string, practiceId: string): Promise<ShareRow | null> {
  return store.findActiveShare(owner, practiceId);
}

/**
 * Public read, used by the page and the JSON route. Unknown and revoked ids are indistinguishable (both null).
 * Goes through the service role in the store; RLS has no anonymous policy on shared_practices.
 */
export async function readPublicShare(store: Store, id: string): Promise<Practice | null> {
  if (!SHARE_ID.test(id)) return null;
  const row = await store.getShare(id);
  if (!row || row.revoked_at) return null;
  const parsed = PracticeSchema.safeParse(row.snapshot);
  if (!parsed.success) return null;
  void store.incrementViews(id).catch(() => undefined);
  return parsed.data;
}

/** Copy a shared practice into a library. Content is kept as shared; AI content stays an AI draft. */
export function practiceFromShare(snapshot: Practice): Practice {
  return { ...structuredClone(snapshot), source: snapshot.source === "ai" ? "ai" : "user" };
}

// Best-effort throttle for the public report endpoint (per server process).
const reportHits = new Map<string, number[]>();
export function allowReport(key: string, now = Date.now(), max = 10, windowMs = 3_600_000): boolean {
  const hits = (reportHits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    reportHits.set(key, hits);
    return false;
  }
  hits.push(now);
  reportHits.set(key, hits);
  return true;
}
