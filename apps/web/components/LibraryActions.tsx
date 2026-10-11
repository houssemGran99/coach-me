"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface Props {
  id: string;
  title: string;
  organisation: string;
  notes: string;
  isAiDraft: boolean;
  children?: ReactNode;
}

type Msg = { kind: "ok" | "bad"; text: string } | null;

/** Edit, duplicate, delete (with an in-page confirmation, no browser dialogs) and confirm a draft. */
export function LibraryActions({ id, title, organisation, notes, isAiDraft, children }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState({ title, organisation, notes });
  const [msg, setMsg] = useState<Msg>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit): Promise<Response | null> {
    setBusy(true);
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
      if (res.status === 401) router.push(`/login?next=/library/${id}`);
      return res;
    } catch {
      setMsg({ kind: "bad", text: t("common.genericError") });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(extra: Record<string, unknown> = {}) {
    const body: Record<string, unknown> = { ...extra };
    if (form.title !== title) body.title = form.title;
    if (form.organisation !== organisation) body.organisation = form.organisation;
    if (form.notes !== notes) body.notes = form.notes;
    if (Object.keys(body).length === 0) return;
    const res = await call(`/api/library/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!res) return;
    if (res.ok) {
      setMsg({ kind: "ok", text: extra.confirmDraft ? t("library.confirmedDraft") : t("library.saved") });
      router.refresh();
    } else setMsg({ kind: "bad", text: t("errors.INVALID_INPUT") });
  }

  async function duplicate() {
    const res = await call(`/api/library/${id}/duplicate`, { method: "POST" });
    if (!res) return;
    if (res.status === 409) return setMsg({ kind: "bad", text: t("errors.LIBRARY_FULL") });
    if (!res.ok) return setMsg({ kind: "bad", text: t("errors.SERVER") });
    const json = (await res.json()) as { id: string };
    setMsg({ kind: "ok", text: t("library.duplicated") });
    router.push(`/library/${json.id}`);
  }

  async function remove() {
    const res = await call(`/api/library/${id}`, { method: "DELETE" });
    if (res?.ok) router.push("/library");
    else if (res) setMsg({ kind: "bad", text: t("errors.NOT_FOUND") });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {children}
        <Link href={`/practice/new?from=${id}`} className="btn btn-sm">{t("library.askChange")}</Link>
        <button type="button" className="btn btn-sm" onClick={duplicate} disabled={busy}>{t("library.duplicate")}</button>
        {isAiDraft && (
          <button type="button" className="btn btn-sm btn-solid" onClick={() => save({ confirmDraft: true })} disabled={busy} data-testid="confirm-draft">
            {t("library.confirmDraft")}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirming(true)} disabled={busy} aria-expanded={confirming}>{t("library.delete")}</button>
      </div>

      {confirming && (
        <div role="alertdialog" aria-labelledby="del-q" className="banner banner-bad grid gap-3" data-testid="delete-confirm">
          <p id="del-q">{t("library.confirmDelete", { name: title })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy} autoFocus>{t("library.confirmDeleteYes")}</button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <form className="card grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="field">
          <label htmlFor="lib-title">{t("library.editTitle")}</label>
          <input id="lib-title" className="input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lib-org">{t("library.editOrganisation")}</label>
          <textarea id="lib-org" className="textarea" maxLength={600} value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lib-notes">{t("library.editNotes")}</label>
          <textarea id="lib-notes" className="textarea" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <p className="hint">{t("library.editHelp")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-solid" disabled={busy}>{t("library.saveChanges")}</button>
          <span role="status" aria-live="polite" className={`text-sm ${msg?.kind === "bad" ? "text-bad" : ""}`}>{msg?.text}</span>
        </div>
      </form>
    </div>
  );
}
