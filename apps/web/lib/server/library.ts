import "server-only";
import { randomUUID } from "node:crypto";
import { PracticeSchema, type Lang, type Practice } from "@mourabbi/schemas";
import { validateSpec } from "@mourabbi/animation";
import { getConfig } from "./config";
import type { PracticeRow, Store } from "./store/types";
import { getTemplate } from "../templates";
import { practiceFromShare, readPublicShare } from "./share";

export type SaveResult =
  | { ok: true; row: PracticeRow }
  | { ok: false; code: "LIBRARY_FULL" | "NOT_FOUND" | "INVALID_INPUT" };

const MAX_TITLE = 120;
const clip = (s: string) => s.trim().slice(0, MAX_TITLE) || "Practice";

async function insertCopy(store: Store, owner: string, practice: Practice, title: string, parent: string | null, notes = ""): Promise<SaveResult> {
  const cfg = getConfig();
  if ((await store.countPractices(owner)) >= cfg.freeLibraryLimit) return { ok: false, code: "LIBRARY_FULL" };
  const id = randomUUID();
  const data: Practice = { ...structuredClone(practice), id };
  const row = await store.insertPractice({
    id, owner, title: clip(title), data, source: data.source, review_status: data.review.status, parent_template_id: parent, notes,
  });
  return { ok: true, row };
}

/** Copy a template into the owner's library. Later template changes never alter the copy. */
export async function saveTemplateCopy(store: Store, owner: string, templateId: string, lang: Lang): Promise<SaveResult> {
  const tpl = getTemplate(templateId);
  if (!tpl) return { ok: false, code: "NOT_FOUND" };
  return insertCopy(store, owner, { ...tpl, source: "user" }, tpl.name[lang], tpl.id);
}

/**
 * Save a practice produced by the chat. The client sends the JSON back, so it is fully revalidated
 * and normalised: AI content can only be saved as an AI draft, never as "reviewed".
 */
export async function saveDraft(store: Store, owner: string, raw: unknown, lang: Lang, parentTemplateId: string | null): Promise<SaveResult> {
  const parsed = PracticeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const p = parsed.data;
  if (validateSpec(p.animation, p.area).length) return { ok: false, code: "INVALID_INPUT" };
  const normalised: Practice = {
    ...p,
    source: "ai",
    review: { status: "ai_draft", reviewedBy: null, reviewedAt: null },
  };
  return insertCopy(store, owner, normalised, p.name[lang], parentTemplateId && getTemplate(parentTemplateId) ? parentTemplateId : null);
}

export async function duplicatePractice(store: Store, owner: string, id: string, suffix: string): Promise<SaveResult> {
  const row = await store.getPractice(owner, id);
  if (!row) return { ok: false, code: "NOT_FOUND" };
  // A duplicate keeps the trust label of its source.
  return insertCopy(store, owner, row.data, `${row.title} ${suffix}`, row.parent_template_id, row.notes);
}

export interface LibraryEdit {
  title?: string;
  organisation?: string;
  confirmDraft?: true;
}

/**
 * Apply an owner edit to a saved practice. Editing the content, or confirming a draft, makes it the
 * owner's own (`edited_by_owner`): it is no longer someone else's "reviewed" content nor an unchecked AI draft.
 * Movement is never changed here. Returns null when the result would be invalid.
 */
export function applyLibraryEdit(current: Practice, edit: LibraryEdit, lang: Lang): Practice | null {
  const data: Practice = structuredClone(current);
  if (edit.title !== undefined) data.name[lang] = edit.title;
  if (edit.organisation !== undefined) data.organisation[lang] = edit.organisation;
  if (edit.title !== undefined || edit.organisation !== undefined || edit.confirmDraft) {
    data.review = { status: "edited_by_owner", reviewedBy: null, reviewedAt: null };
  }
  const checked = PracticeSchema.safeParse(data);
  return checked.success ? checked.data : null;
}

/** "Save to my library" on a public page: copies the shared snapshot. */
export async function saveSharedCopy(store: Store, owner: string, sharedId: string, lang: Lang): Promise<SaveResult> {
  const snapshot = await readPublicShare(store, sharedId);
  if (!snapshot) return { ok: false, code: "NOT_FOUND" };
  return insertCopy(store, owner, practiceFromShare(snapshot), snapshot.name[lang], null);
}
