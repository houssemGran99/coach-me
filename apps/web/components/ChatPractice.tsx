"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Practice } from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";
import { PracticeView } from "./PracticeView";
import { ShareDialog } from "./ShareDialog";

type Kind = "template_adapted" | "new_draft" | "closest_template" | "refined" | "current";
interface Version {
  n: number;
  practice: Practice;
  kind: Kind;
  templateId: string | null;
  savedId?: string;
}
interface Line {
  role: "user" | "assistant";
  text: string;
}
type Event =
  | { type: "stage"; stage: string }
  | { type: "result"; kind: Exclude<Kind, "current">; practice: Practice; templateId: string | null }
  | { type: "error"; code: string; message: string };

const KEY = "mrb-chat-v1";
const MAX_VERSIONS = 10;
const MAX_MESSAGE = 600;

interface Props {
  /** A saved practice to refine ("Ask for a change in chat"). */
  fromLibrary?: { id: string; practice: Practice };
}

/** The practice chat: describe a drill, get a draft with its animation, refine it, keep the last 10 versions. */
export function ChatPractice({ fromLibrary }: Props) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [versions, setVersions] = useState<Version[]>(() =>
    fromLibrary ? [{ n: 1, practice: fromLibrary.practice, kind: "current", templateId: null, savedId: fromLibrary.id }] : [],
  );
  const [current, setCurrent] = useState(fromLibrary ? 1 : 0);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const counter = useRef(fromLibrary ? 1 : 0);
  const busy = stage !== null;
  const cur = versions.find((v) => v.n === current);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Restore the conversation after a reload (browser storage is a convenience, never required).
  useEffect(() => {
    if (fromLibrary) return;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { versions: Version[]; current: number; lines: Line[]; counter: number };
      setVersions(s.versions);
      setCurrent(s.current);
      setLines(s.lines);
      counter.current = s.counter;
    } catch {
      /* ignore */
    }
  }, [fromLibrary]);
  useEffect(() => {
    if (fromLibrary || !versions.length) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ versions, current, lines, counter: counter.current }));
    } catch {
      /* ignore */
    }
  }, [versions, current, lines, fromLibrary]);

  const errorText = (code: string, fallback?: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`, { n: 20 }) : (fallback ?? t("errors.SERVER"));

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    if (!navigator.onLine) return setError(t("chat.offline"));
    if (text.length > MAX_MESSAGE) return setError(t("chat.tooLong", { n: MAX_MESSAGE }));
    setError(null);
    setSaveMsg(null);
    setStage("check");
    setLines((l) => [...l, { role: "user", text }]);
    setInput("");
    try {
      const body: Record<string, unknown> = { message: text };
      if (cur) {
        if (cur.kind === "current" && fromLibrary && versions.length === 1) body.from = fromLibrary.id;
        else body.previous = cur.practice;
      }
      const res = await fetch("/api/practices/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) return router.push("/login?next=/practice/new");
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        setError(errorText(j.error?.code ?? "SERVER"));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(JSON.parse(line) as Event);
        }
      }
    } catch {
      setError(t("common.genericError"));
    } finally {
      setStage(null);
    }
  }

  function handle(ev: Event) {
    if (ev.type === "stage") return setStage(ev.stage);
    if (ev.type === "error") return setError(errorText(ev.code, ev.message));
    counter.current += 1;
    const n = counter.current;
    setVersions((vs) => [...vs, { n, practice: ev.practice, kind: ev.kind, templateId: ev.templateId }].slice(-MAX_VERSIONS));
    setCurrent(n);
    const note =
      ev.kind === "template_adapted"
        ? t("chat.adaptedFrom", { name: ev.practice.name[locale] })
        : ev.kind === "closest_template"
          ? t("chat.closestTemplate")
          : t("chat.newDraft");
    setLines((l) => [...l, { role: "assistant", text: note }]);
  }

  async function save() {
    if (!cur) return;
    setSaveMsg(null);
    const body = cur.kind === "closest_template" && cur.templateId ? { templateId: cur.templateId } : { practice: cur.practice, parentTemplateId: cur.templateId };
    try {
      const res = await fetch("/api/practices/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) return router.push("/login?next=/practice/new");
      if (res.status === 409) return setSaveMsg(t("errors.LIBRARY_FULL"));
      if (!res.ok) return setSaveMsg(t("errors.SERVER"));
      const { id } = (await res.json()) as { id: string };
      setVersions((vs) => vs.map((v) => (v.n === cur.n ? { ...v, savedId: id } : v)));
      setSaveMsg(t("chat.saved"));
    } catch {
      setSaveMsg(t("common.needsConnection"));
    }
  }

  const suggestions = t.raw("chat.suggestions") as string[];

  return (
    <div className="grid gap-6">
      {lines.length > 0 && (
        <ol className="grid gap-2" aria-label={t("chat.versions")} data-testid="chat-lines">
          {lines.map((l, i) => (
            <li key={i} className={`max-w-[60ch] rounded-lg px-3 py-2 text-[15px] ${l.role === "user" ? "bg-surface-2" : "banner"}`}>
              <span className="eyebrow block">{l.role === "user" ? t("chat.you") : t("chat.assistant")}</span>
              <span dir="auto">{l.text}</span>
            </li>
          ))}
        </ol>
      )}

      {cur ? (
        <section className="grid gap-4" aria-live="polite" data-testid="chat-result">
          {cur.kind === "closest_template" && <p className="banner banner-warn">{t("chat.closestTemplate")}</p>}
          <PracticeView
            practice={cur.practice}
            headingLevel={2}
            actions={
              <>
                <button type="button" className="btn btn-solid" onClick={save} disabled={!!cur.savedId} data-testid="chat-save">{t("chat.save")}</button>
                {cur.savedId && (
                  <>
                    <Link className="btn" href={`/library/${cur.savedId}`}>{t("common.open")}</Link>
                    <ShareDialog practiceId={cur.savedId} name={cur.practice.name[locale]} signedIn returnTo={`/library/${cur.savedId}`} aiDraft={cur.practice.review.status === "ai_draft"} />
                  </>
                )}
                <span role="status" aria-live="polite" className="self-center text-sm">{saveMsg}</span>
              </>
            }
          />
        </section>
      ) : (
        <p className="muted">{t("chat.empty")}</p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="card grid gap-3" aria-label={t("chat.title")}>
        <div className="field">
          <label htmlFor="chat-input">{cur ? t("chat.refine") : t("chat.title")}</label>
          <textarea
            id="chat-input" data-testid="chat-input" className="textarea" maxLength={MAX_MESSAGE} value={input} dir="auto" disabled={busy}
            placeholder={cur ? t("chat.refinePlaceholder") : t("chat.placeholder")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(input); } }}
          />
          <p className="hint">{input.length}/{MAX_MESSAGE}</p>
        </div>
        {!cur && (
          <div className="grid gap-2">
            <p className="eyebrow">{t("chat.suggestionsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" className="btn btn-sm text-start" disabled={busy} onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim() || !online} data-testid="chat-send">
            {busy ? t(`chat.stages.${stage}`) : cur ? t("chat.refine") : t("chat.send")}
          </button>
          {!online && <span className="text-sm text-warn" data-testid="chat-offline">{t("chat.offline")}</span>}
        </div>
        <div role="status" aria-live="polite" className="text-sm">
          {busy && <span data-testid="chat-stage">{t(`chat.stages.${stage}`)}…</span>}
          {error && <p className="banner banner-bad" data-testid="chat-error">{error}</p>}
        </div>
      </form>

      {versions.length > 1 && (
        <section className="grid gap-2" aria-labelledby="versions-h">
          <h2 id="versions-h" className="eyebrow">{t("chat.versions")}</h2>
          <ul className="grid gap-2" data-testid="versions">
            {[...versions].reverse().map((v) => (
              <li key={v.n} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold">{t("chat.version", { n: v.n })}</span>
                <span className="muted">{v.practice.name[locale]}</span>
                {v.n === current ? (
                  <span className="tag">{t("chat.current")}</span>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => setCurrent(v.n)} disabled={busy}>{t("chat.restore")}</button>
                )}
              </li>
            ))}
          </ul>
          <p className="hint">{t("chat.keepLast")}</p>
        </section>
      )}
    </div>
  );
}
