"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AGE_GROUPS, EQUIPMENT, SURFACES, THEMES, type SessionRequest } from "@mourabbi/schemas";
import { ageLabel } from "@/lib/locale";
import type { Locale } from "@/i18n/config";

interface Props {
  locale: Locale;
  initial: SessionRequest;
  /** Practice to build the session around ("Use in a session"). */
  include?: string;
  /** When set, shows a "squad details changed" banner if the form differs from this request. */
  generatedFrom?: SessionRequest;
  submitLabel?: string;
}

const sameRequest = (a: SessionRequest, b: SessionRequest) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = (r: SessionRequest) => ({
  m: { ...r.meta, equipment: [...r.meta.equipment].sort(), language: undefined },
  f: r.focus,
});

export function PlanForm({ locale, initial, include, generatedFrom, submitLabel }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const uid = useId();
  const [meta, setMeta] = useState(initial.meta);
  const [focus, setFocus] = useState(initial.focus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: SessionRequest = useMemo(() => ({ meta: { ...meta, language: locale }, focus }), [meta, focus, locale]);
  const stale = generatedFrom ? !sameRequest(current, generatedFrom) : false;
  const num = (v: string, fallback: number) => (v === "" ? fallback : Number(v));
  const id = (n: string) => `${uid}-${n}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!navigator.onLine) {
      setError(t("common.needsConnection"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meta: current.meta, focus, ...(include ? { include } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { code?: string } };
      if (res.ok && json.id) {
        router.push(`/plan/${json.id}`);
        return;
      }
      const code = json.error?.code ?? "SERVER";
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.SERVER"));
      if (res.status === 401) router.push("/login?next=/plan/new");
    } catch {
      setError(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const toggleEquip = (e: (typeof EQUIPMENT)[number]) =>
    setMeta((m) => ({ ...m, equipment: m.equipment.includes(e) ? m.equipment.filter((x) => x !== e) : [...m.equipment, e] }));

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={t("plan.squad")} noValidate>
      <h2 className="eyebrow">{t("plan.squad")}</h2>
      {stale && (
        <p className="banner banner-warn" role="status" data-testid="stale-banner">{t("plan.stale")}</p>
      )}
      <div className="field">
        <label htmlFor={id("age")}>{t("plan.age")}</label>
        <select id={id("age")} className="select" value={meta.ageGroup} onChange={(e) => setMeta({ ...meta, ageGroup: e.target.value as typeof meta.ageGroup })}>
          {AGE_GROUPS.map((a) => <option key={a} value={a}>{ageLabel(a, t("ages.senior"))}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor={id("players")}>{t("plan.players")}</label>
          <input id={id("players")} className="input" type="number" inputMode="numeric" min={2} max={60} value={meta.playerCount}
            onChange={(e) => setMeta({ ...meta, playerCount: num(e.target.value, 0) })} />
        </div>
        <div className="field">
          <label htmlFor={id("minutes")}>{t("plan.minutes")}</label>
          <input id={id("minutes")} className="input" type="number" inputMode="numeric" min={30} max={150} value={meta.availableMinutes}
            onChange={(e) => setMeta({ ...meta, availableMinutes: num(e.target.value, 0) })} />
        </div>
        <div className="field">
          <label htmlFor={id("len")}>{t("plan.length")}</label>
          <input id={id("len")} className="input" type="number" inputMode="numeric" min={5} max={200} value={meta.space.lengthM}
            onChange={(e) => setMeta({ ...meta, space: { ...meta.space, lengthM: num(e.target.value, 0) } })} />
        </div>
        <div className="field">
          <label htmlFor={id("wid")}>{t("plan.width")}</label>
          <input id={id("wid")} className="input" type="number" inputMode="numeric" min={5} max={200} value={meta.space.widthM}
            onChange={(e) => setMeta({ ...meta, space: { ...meta.space, widthM: num(e.target.value, 0) } })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("surface")}>{t("plan.surface")}</label>
        <select id={id("surface")} className="select" value={meta.space.surface} onChange={(e) => setMeta({ ...meta, space: { ...meta.space, surface: e.target.value as typeof meta.space.surface } })}>
          {SURFACES.map((s) => <option key={s} value={s}>{t(`surfaces.${s}`)}</option>)}
        </select>
      </div>
      <fieldset className="field border-0 p-0">
        <legend className="lab mb-1 text-xs font-semibold uppercase tracking-wider muted">{t("plan.equipment")}</legend>
        <div className="chips">
          {EQUIPMENT.map((e) => (
            <label key={e} className="chip">
              <input type="checkbox" checked={meta.equipment.includes(e)} onChange={() => toggleEquip(e)} />
              <span>{t(`equipment.${e}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={id("theme")}>{t("plan.focus")}</label>
        <select id={id("theme")} className="select" value={focus.theme} onChange={(e) => setFocus({ ...focus, theme: e.target.value as typeof focus.theme })}>
          {THEMES.map((k) => <option key={k} value={k}>{t(`themes.${k}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("note")}>{t("plan.note")}</label>
        <textarea id={id("note")} className="textarea" maxLength={500} value={focus.sourceNote} placeholder={t("plan.notePlaceholder")}
          aria-describedby={id("note-hint")} onChange={(e) => setFocus({ ...focus, sourceNote: e.target.value })} />
        <p id={id("note-hint")} className="hint">{t("plan.noteHint")} ({focus.sourceNote.length}/500)</p>
      </div>
      {include && <p className="hint" data-testid="include-note">+ {include.replaceAll("_", " ")}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy} data-testid="generate">
        {busy ? t("plan.generating") : (submitLabel ?? t("plan.generate"))}
      </button>
      <div role="status" aria-live="polite">
        {error && <p className="banner banner-bad" data-testid="plan-error">{error}</p>}
      </div>
    </form>
  );
}
