"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PracticePlayer } from "@mourabbi/animation";
import { DifficultyBadge } from "./DifficultyBadge";
import {
  hasProblem, maxCoachingPoints, runSessionChecks, trustLabel,
  type Practice, type Reflection, type TrainingSession,
} from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";
import { ageLabel } from "@/lib/locale";
import { buildShareText, describeChecks, whatsappUrl, type T } from "@/lib/session-text";
import { SaveToLibraryButton } from "./SaveToLibraryButton";

interface EditPhase {
  practiceId: string;
  durationMinutes: number;
  note: string;
}

interface Props {
  session: TrainingSession;
  practices: Record<string, Practice>;
  /** Library titles by practice id (owner-chosen names). */
  titles: Record<string, string>;
  libraryIds: string[];
  libraryFull: boolean;
  locale: Locale;
}

const GROUP: Record<string, "k-prep" | "k-skill" | "k-game"> = {
  warmup: "k-prep", cooldown: "k-prep", technical: "k-skill", main: "k-skill", game_related: "k-game", game: "k-game",
};
const GROUP_KEY = { "k-prep": "groupPrep", "k-skill": "groupSkill", "k-game": "groupGame" } as const;

export function SessionEditor({ session, practices, titles, libraryIds, libraryFull, locale }: Props) {
  const tt = useTranslations();
  const t = tt as unknown as T;
  const map = useMemo(() => new Map(Object.entries(practices)), [practices]);
  const titleMap = useMemo(() => new Map(Object.entries(titles)), [titles]);
  const nameOf = (p: Practice) => titleMap.get(p.id) ?? p.name[locale];

  const [phases, setPhases] = useState<EditPhase[]>(() =>
    session.phases.map((p) => ({ practiceId: p.practiceId, durationMinutes: p.durationMinutes, note: p.note ?? "" })),
  );
  const firstPlayable = session.phases.find((p) => p.kind !== "warmup" && p.kind !== "cooldown")?.practiceId;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [reflection, setReflection] = useState<Reflection>(
    session.reflection ?? { worked: "", didNotWork: "", nextAction: "", rating: 3 },
  );
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(JSON.stringify(session.phases.map((p) => [p.practiceId, p.durationMinutes, p.note ?? ""])));

  const total = phases.reduce((s, p) => s + p.durationMinutes, 0);
  const avail = session.meta.availableMinutes;
  const lookup = useCallback((id: string) => map.get(id), [map]);
  const checks = useMemo(
    () =>
      runSessionChecks(
        { meta: session.meta, phases: phases.map((p) => ({ practiceId: p.practiceId, kind: map.get(p.practiceId)?.kind, durationMinutes: p.durationMinutes })), totalDurationMinutes: total },
        lookup,
      ),
    [phases, session.meta, total, lookup, map],
  );
  const lines = useMemo(() => describeChecks(checks, map, locale, t), [checks, map, locale, t]);
  const passed = checks.filter((c) => c.status === "pass").length;

  // Every edit re-runs the checks above immediately and is saved a moment later.
  useEffect(() => {
    const key = JSON.stringify(phases.map((p) => [p.practiceId, p.durationMinutes, p.note]));
    if (key === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phases: phases.map((p) => ({ practiceId: p.practiceId, durationMinutes: p.durationMinutes, ...(p.note ? { note: p.note } : {}) })) }),
        });
        if (res.ok) lastSaved.current = key;
        setSaveState(res.ok ? "saved" : "failed");
      } catch {
        setSaveState("failed");
      }
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phases, session.id]);

  const setDuration = (i: number, v: number) =>
    setPhases((ps) => ps.map((p, k) => (k === i ? { ...p, durationMinutes: Math.min(45, Math.max(3, Math.round(v) || 3)) } : p)));
  const move = (i: number, d: -1 | 1) =>
    setPhases((ps) => {
      const j = i + d;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const shareText = useMemo(
    () => buildShareText({ meta: session.meta, focus: session.focus, totalDurationMinutes: total, phases: phases.map((p, i) => ({ order: i + 1, practiceId: p.practiceId, kind: map.get(p.practiceId)?.kind ?? "main", durationMinutes: p.durationMinutes })) }, map, locale, t, titleMap),
    [session.meta, session.focus, phases, total, map, locale, t, titleMap],
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied("ok");
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = shareText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
      setCopied(ok ? "ok" : "fail");
    }
  }

  async function saveReflection() {
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reflection }),
    });
    setReflectionSaved(res.ok);
  }

  const limit = maxCoachingPoints(session.meta.ageGroup);
  const groupTotals = (["k-prep", "k-skill", "k-game"] as const).map((g) => ({
    g,
    n: phases.filter((p) => GROUP[map.get(p.practiceId)?.kind ?? "main"] === g).reduce((s, p) => s + p.durationMinutes, 0),
  }));

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <h1 className="display text-5xl leading-none">
          {tt("plan.sessionFor", { age: ageLabel(session.meta.ageGroup, tt("ages.senior")) })}
        </h1>
        <p className="muted text-sm">
          {tt("plan.metaLine", { n: session.meta.playerCount, l: session.meta.space.lengthM, w: session.meta.space.widthM, surface: tt(`surfaces.${session.meta.space.surface}`) })}
          {" · "}{tt(`themes.${session.focus.theme}`)}
        </p>
        {session.source === "fallback" && <p className="banner banner-warn" data-testid="fallback-note">{tt("plan.fallbackNote")}</p>}
        <div className="flex flex-wrap items-baseline gap-2" data-testid="clock">
          <span className={`display text-7xl leading-[0.9] tabular-nums ${total > avail ? "text-bad" : ""}`}>{total}</span>
          <span className="display text-2xl">{tt("common.min")}</span>
          <span className="muted text-sm">{tt("plan.ofAvailable", { n: avail })}{avail > total ? ` · ${tt("plan.unplanned", { n: avail - total })}` : ""}</span>
        </div>
        <div className="flex h-3.5 gap-0.5" aria-hidden="true">
          {phases.map((p, i) => (
            <i key={i} className={`block min-w-1 rounded-sm ${GROUP[map.get(p.practiceId)?.kind ?? "main"]}`} style={{ flex: p.durationMinutes, background: "var(--kc)" }} />
          ))}
        </div>
        <div className="muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {groupTotals.map(({ g, n }) => (
            <span key={g} className={`kind ${g}`}>{tt(`plan.${GROUP_KEY[g]}`)} {n} {tt("common.min")}</span>
          ))}
        </div>
      </header>

      <section className="card grid gap-3" aria-labelledby="checks-h" data-testid="checks">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="checks-h" className="eyebrow">{tt("plan.checks")}</h2>
          <span className="muted text-sm tabular-nums">{tt("plan.checksSummary", { ok: passed, n: checks.length })}</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {lines.map((l) => (
            <li key={l.id} className={`grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 text-sm`} data-check={l.id} data-status={l.status}>
              <span aria-hidden="true" className={`mt-0.5 font-bold ${l.status === "pass" ? "text-ok" : l.status === "warning" ? "text-warn" : "text-bad"}`}>
                {l.status === "pass" ? "✓" : l.status === "warning" ? "!" : "✕"}
              </span>
              <span>
                <span className="font-semibold">{l.label}</span>
                <span className="sr-only-x"> — {tt(`plan.status.${l.status}`)}</span>
                {l.details.map((d, i) => (
                  <span key={i} className={`block text-[13px] ${l.status === "problem" ? "text-bad" : "muted"}`}>{d}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {hasProblem(checks) && <span className="sr-only-x" role="alert">{tt("plan.status.problem")}</span>}
      </section>

      <section aria-label={tt("plan.phase", { n: "" })} className="grid">
        <ol className="grid">
          {phases.map((ph, i) => {
            const p = map.get(ph.practiceId);
            if (!p) return null;
            const kindGroup = GROUP[p.kind];
            const label = trustLabel(p);
            return (
              <li key={ph.practiceId} className="grid gap-4 border-t border-line py-6 first:border-t-0 sm:grid-cols-[84px_minmax(0,1fr)]" data-testid="phase" data-practice={ph.practiceId}>
                <div className="flex items-center gap-3 sm:flex-col sm:items-stretch">
                  <div className="flex flex-col items-center">
                    <div className="grid grid-cols-[44px_auto_44px] items-center gap-1 sm:grid-cols-1 sm:justify-items-center">
                      <button type="button" className="btn btn-sm !min-h-11 !px-0" onClick={() => setDuration(i, ph.durationMinutes - 5)} disabled={ph.durationMinutes <= 3} aria-label={`${tt("plan.shorter")}: ${nameOf(p)}`}>−</button>
                      <label className="grid justify-items-center">
                        <span className="sr-only-x">{tt("plan.durationOf", { name: nameOf(p) })}</span>
                        <input type="number" inputMode="numeric" min={3} max={45} value={ph.durationMinutes} onChange={(e) => setDuration(i, Number(e.target.value))}
                          className="display min-h-11 w-16 border-0 bg-transparent text-center text-4xl leading-none tabular-nums" data-testid="duration" />
                        <span className="muted text-[11px] uppercase tracking-wider">{tt("common.min")}</span>
                      </label>
                      <button type="button" className="btn btn-sm !min-h-11 !px-0" onClick={() => setDuration(i, ph.durationMinutes + 5)} disabled={ph.durationMinutes >= 45} aria-label={`${tt("plan.longer")}: ${nameOf(p)}`}>+</button>
                    </div>
                  </div>
                  <div className="ms-auto flex gap-1 sm:ms-0 sm:justify-center">
                    <button type="button" className="btn btn-sm !px-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${tt("plan.moveUp")}: ${nameOf(p)}`}>↑</button>
                    <button type="button" className="btn btn-sm !px-0" onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label={`${tt("plan.moveDown")}: ${nameOf(p)}`}>↓</button>
                  </div>
                </div>
                <div className="grid min-w-0 gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`kind font-semibold uppercase tracking-wider ${kindGroup}`}>{tt(`kinds.${p.kind}`)}</span>
                    <span className="muted">{tt("plan.phase", { n: i + 1 })}</span>
                    <DifficultyBadge level={p.difficulty} />
                    {label === "reviewed" ? <span className="badge badge-ok">{tt("trust.reviewed", { name: p.review.reviewedBy ?? "" })}</span>
                      : label === "ai_draft" ? <span className="badge badge-ai">{tt("trust.aiDraft")}</span>
                      : label === "edited_by_owner" ? <span className="badge">{tt("trust.edited")}</span>
                      : <span className="badge">{tt("trust.pending")}</span>}
                  </div>
                  <h3 className="display text-3xl leading-tight">{nameOf(p)}</h3>
                  <p className="muted max-w-[68ch] text-[15px]">{p.organisation[locale]}</p>
                  <div className="grid gap-1">
                    <p className="eyebrow">{tt("plan.points")}</p>
                    <ul className="pts grid gap-1 text-[15px]">
                      {p.coachingPoints[locale].slice(0, limit).map((pt) => <li key={pt}>{pt}</li>)}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="btn btn-sm" href={libraryIds.includes(p.id) ? `/library/${p.id}` : `/templates/${p.id}`}>{tt("plan.openPractice")}</Link>
                    <SaveToLibraryButton practiceId={p.id} fromLibrary={libraryIds.includes(p.id)} full={libraryFull} />
                  </div>
                  <PracticePlayer practice={p} lang={locale} autoplay={ph.practiceId === firstPlayable} />
                  <div className="field">
                    <label htmlFor={`note-${i}`}>{tt("plan.notes")}</label>
                    <textarea id={`note-${i}`} className="textarea !min-h-16" maxLength={500} value={ph.note} placeholder={tt("plan.notesPlaceholder")}
                      onChange={(e) => setPhases((ps) => ps.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="muted text-sm" role="status" aria-live="polite" data-testid="save-state">
          {saveState === "saving" ? tt("plan.saving") : saveState === "saved" ? tt("plan.savedAt") : saveState === "failed" ? tt("plan.saveFailed") : ""}
        </p>
      </section>

      <section className="card grid gap-3" aria-labelledby="share-h">
        <h2 id="share-h" className="eyebrow">{tt("plan.share")}</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-solid" href={whatsappUrl(shareText)} target="_blank" rel="noopener noreferrer" data-testid="whatsapp">{tt("plan.whatsapp")}</a>
          <button type="button" className="btn" onClick={copyText} data-testid="copy-text">{tt("plan.copyText")}</button>
          <span className="self-center text-sm" role="status" aria-live="polite">
            {copied === "ok" ? tt("common.copied") : copied === "fail" ? tt("common.copyFailed") : ""}
          </span>
        </div>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{tt("plan.messagePreview")}</summary>
          <pre className="mt-2 max-w-[56ch] whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-[15px]" dir="auto" data-testid="share-preview">{shareText}</pre>
        </details>
      </section>

      <section className="card grid gap-3" aria-labelledby="after-h">
        <h2 id="after-h" className="eyebrow">{tt("plan.after")}</h2>
        {(["worked", "didNotWork", "nextAction"] as const).map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`r-${k}`}>{tt(`plan.${k}`)}</label>
            <textarea id={`r-${k}`} className="textarea !min-h-16" maxLength={1000} value={reflection[k]} onChange={(e) => { setReflection({ ...reflection, [k]: e.target.value }); setReflectionSaved(false); }} />
          </div>
        ))}
        <div className="field">
          <span className="lab" id="rating-l">{tt("plan.rating")}</span>
          <div className="flex gap-1.5" role="group" aria-labelledby="rating-l">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-pressed={reflection.rating === n} aria-label={tt("plan.ratingValue", { n })}
                className={`display h-11 w-11 rounded-md border text-xl ${reflection.rating === n ? "border-ink bg-ink text-bg" : "border-line bg-surface"}`}
                onClick={() => { setReflection({ ...reflection, rating: n }); setReflectionSaved(false); }}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-solid" onClick={saveReflection} data-testid="save-reflection">{tt("plan.saveReflection")}</button>
          <span role="status" aria-live="polite" className="text-sm">{reflectionSaved ? tt("plan.reflectionSaved") : ""}</span>
        </div>
      </section>
    </div>
  );
}
