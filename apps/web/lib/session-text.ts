import type { AgeGroup, Check, Practice, TrainingSession } from "@mourabbi/schemas";
import { maxCoachingPoints } from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";

/** Translator over the root messages object (next-intl's `t` cast to this shape). */
export type T = (key: string, values?: Record<string, string | number>) => string;

const ageText = (a: AgeGroup, t: T) => (a === "senior" ? t("ages.senior") : a);

/** Plain-text summary of a session for WhatsApp: title, phases with minutes, key coaching points. */
export function buildShareText(
  session: Pick<TrainingSession, "meta" | "focus" | "phases" | "totalDurationMinutes">,
  practices: Map<string, Practice>,
  locale: Locale,
  t: T,
  titles?: Map<string, string>,
): string {
  const { meta, focus } = session;
  const lines: string[] = [];
  lines.push(t("plan.shareHeading", { age: ageText(meta.ageGroup, t), theme: t(`themes.${focus.theme}`) }));
  lines.push(t("plan.shareMeta", { n: meta.playerCount, m: session.totalDurationMinutes }));
  lines.push("");
  const limit = maxCoachingPoints(meta.ageGroup);
  session.phases.forEach((ph, i) => {
    const p = practices.get(ph.practiceId);
    if (!p) return;
    const name = titles?.get(p.id) ?? p.name[locale];
    lines.push(`${i + 1}. ${name} (${t("common.minutes", { n: ph.durationMinutes })})`);
    for (const pt of p.coachingPoints[locale].slice(0, Math.min(2, limit))) lines.push(`   - ${pt}`);
  });
  lines.push("");
  lines.push(t("plan.shareFooter"));
  return lines.join("\n");
}

export const whatsappUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

export interface CheckLine {
  id: Check["id"];
  status: Check["status"];
  label: string;
  details: string[];
}

/** Human text for each check, in the UI language. */
export function describeChecks(checks: Check[], practices: Map<string, Practice>, locale: Locale, t: T): CheckLine[] {
  const nameOf = (id?: string) => (id ? (practices.get(id)?.name[locale] ?? id) : "");
  const items = (csv: string | number | undefined) =>
    String(csv ?? "").split(",").filter(Boolean).map((e) => t(`equipment.${e}`)).join(", ");
  return checks.map((c) => {
    const base = `plan.check.${c.id}`;
    let details: string[] = [];
    if (c.status === "pass") {
      details = [t(`${base}.ok`, { ...c.params, age: c.id === "age" ? ageText(c.params.age as AgeGroup, t) : "" })];
    } else if (c.id === "time") {
      if (c.failures.some((f) => f.params.mismatch)) details.push(t(`${base}.mismatch`, c.params));
      if (Number(c.params.over) > 0) details.push(t(`${base}.bad`, c.params));
    } else if (c.failures.length) {
      details = c.failures.map((f) =>
        t(`${base}.bad`, {
          ...c.params,
          ...f.params,
          age: c.id === "age" ? ageText(c.params.age as AgeGroup, t) : "",
          drill: nameOf(f.practiceId),
          items: items(f.params.items),
          n: c.id === "known" ? c.failures.length : String(f.params.n ?? c.params.n ?? ""),
        }),
      );
      if (c.id === "known" || c.id === "review") details = [t(`${base}.bad`, { ...c.params, n: c.id === "known" ? c.failures.length : (c.params.n ?? 0) })];
    } else {
      details = [t(`${base}.bad`, c.params)];
    }
    return { id: c.id, status: c.status, label: t(`${base}.label`), details };
  });
}
