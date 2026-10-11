"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { copyToClipboard } from "@/lib/clipboard";

interface Props {
  /** Library practice id or template id. */
  practiceId: string;
  name: string;
  signedIn: boolean;
  /** Where to come back to after signing in. */
  returnTo: string;
  aiDraft?: boolean;
}

type Msg = { kind: "ok" | "bad"; text: string } | null;

/** In-page share panel: create, copy, send on WhatsApp, update, replace or stop a link. */
export function ShareDialog({ practiceId, name, signedIn, returnTo, aiDraft }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const url = shareId && typeof window !== "undefined" ? `${window.location.origin}/p/${shareId}?lang=${locale}` : "";

  async function toggle() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(returnTo)}`);
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      try {
        const res = await fetch(`/api/share?practiceId=${encodeURIComponent(practiceId)}`);
        if (res.ok) setShareId(((await res.json()) as { id: string | null }).id);
      } catch {
        setMsg({ kind: "bad", text: t("common.needsConnection") });
      }
      setLoaded(true);
    }
  }

  async function create(mode?: "update" | "new") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practiceId, ...(mode ? { mode } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { code?: string; id?: string; limit?: number } };
      if (res.ok && json.id) {
        setShareId(json.id);
        if (mode === "update") setMsg({ kind: "ok", text: t("share.updated") });
      } else if (res.status === 409 && json.error?.id) {
        setShareId(json.error.id);
        setMsg({ kind: "ok", text: t("share.alreadyShared") });
      } else if (res.status === 429) {
        setMsg({ kind: "bad", text: t("share.limit", { n: json.error?.limit ?? 30 }) });
      } else if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      } else {
        setMsg({ kind: "bad", text: t("errors.SERVER") });
      }
    } catch {
      setMsg({ kind: "bad", text: t("common.needsConnection") });
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!shareId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/share/${shareId}`, { method: "DELETE" });
      if (res.ok) {
        setShareId(null);
        setMsg({ kind: "ok", text: t("share.stopped") });
      } else setMsg({ kind: "bad", text: t("errors.SERVER") });
    } catch {
      setMsg({ kind: "bad", text: t("common.needsConnection") });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setMsg({ kind: "ok", text: (await copyToClipboard(url)) ? t("common.copied") : t("common.copyFailed") });
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${t("share.whatsappText", { name })}\n${url}`)}`;

  return (
    <div className="grid gap-3">
      <button type="button" className="btn btn-sm" aria-expanded={open} aria-controls="share-panel" onClick={toggle} data-testid="share-open">
        {t("templates.share")}
      </button>
      {open && (
        <section id="share-panel" className="card grid gap-3" aria-label={t("share.title")} data-testid="share-panel">
          <p className="text-sm">{t("share.intro")}</p>
          {aiDraft && <p className="banner banner-warn text-sm">{t("share.aiNote")}</p>}
          {!shareId ? (
            <div>
              <button type="button" className="btn btn-solid" onClick={() => create()} disabled={busy} data-testid="share-create">
                {busy ? t("share.creating") : t("share.create")}
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="share-url">{t("share.link")}</label>
                <input id="share-url" className="input" readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} data-testid="share-url" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-solid" onClick={copy} data-testid="share-copy">{t("share.copyLink")}</button>
                <a className="btn btn-sm" href={wa} target="_blank" rel="noopener noreferrer" data-testid="share-whatsapp">{t("share.whatsapp")}</a>
                <button type="button" className="btn btn-sm btn-danger" onClick={stop} disabled={busy} data-testid="share-stop">{t("share.stop")}</button>
              </div>
              <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <button type="button" className="btn btn-sm" onClick={() => create("update")} disabled={busy} data-testid="share-update">{t("share.updateLink")}</button>
                  <p className="hint">{t("share.updateHelp")}</p>
                </div>
                <div className="grid gap-1">
                  <button type="button" className="btn btn-sm" onClick={() => create("new")} disabled={busy} data-testid="share-new">{t("share.newLink")}</button>
                  <p className="hint">{t("share.newHelp")}</p>
                </div>
              </div>
            </>
          )}
          <p role="status" aria-live="polite" className={`text-sm ${msg?.kind === "bad" ? "text-bad" : ""}`}>{msg?.text}</p>
        </section>
      )}
    </div>
  );
}
