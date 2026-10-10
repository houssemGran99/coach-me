import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PracticePlayer } from "@mourabbi/animation";
import type { Practice } from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";
import { PracticeMeta } from "./PracticeMeta";
import { TrustBadge } from "./TrustBadge";

interface Props {
  practice: Practice;
  /** Overrides the shown title (library items have an owner-chosen title). */
  title?: string;
  actions?: ReactNode;
  autoplay?: boolean;
  /** Limit the coaching points shown (play-based sessions for young groups). */
  maxPoints?: number;
  /** Labels namespace for headings: "templates" or "public". */
  headings?: "templates" | "public";
  children?: ReactNode;
}

/** Full practice: animation player, set-up, coaching points, variants. Used by gallery, library and the public page. */
export function PracticeView({ practice, title, actions, autoplay, maxPoints, headings = "templates", children }: Props) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const h = (k: string) => t(`${headings}.${k}`);
  const points = practice.coachingPoints[locale].slice(0, maxPoints ?? 5);
  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start" data-testid="practice-view">
      <div className="grid gap-4 lg:sticky lg:top-4">
        <PracticePlayer practice={practice} lang={locale} autoplay={autoplay} />
      </div>
      <div className="grid gap-5">
        <header className="grid gap-2">
          <h1 className="display text-4xl leading-none sm:text-5xl">{title ?? practice.name[locale]}</h1>
          <PracticeMeta practice={practice} />
          <div className="flex flex-wrap items-center gap-2">
            <TrustBadge practice={practice} />
            {practice.review.status === "ai_draft" && <span className="hint">{t("trust.aiHelp")}</span>}
          </div>
        </header>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        <section className="grid gap-1">
          <h2 className="eyebrow">{h("organisation")}</h2>
          <p className="max-w-[68ch]">{practice.organisation[locale]}</p>
        </section>
        <section className="grid gap-2">
          <h2 className="eyebrow">{h("coachingPoints")}</h2>
          <ul className="pts grid gap-1">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
        {practice.variants.length > 0 && (
          <section className="grid gap-2">
            <h2 className="eyebrow">{h("variants")}</h2>
            <ul className="grid gap-1 text-sm">
              {practice.variants.map((v) => (
                <li key={v.label}>
                  <strong>{t(`variants.${v.label}`)}: </strong>
                  <span className="muted">{v.text[locale]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {practice.equipment.length > 0 && (
          <section className="grid gap-2">
            <h2 className="eyebrow">{t("templates.needs")}</h2>
            <div className="flex flex-wrap gap-2">
              {practice.equipment.map((e) => (
                <span key={e} className="tag">{t(`equipment.${e}`)}</span>
              ))}
            </div>
          </section>
        )}
        {children}
      </div>
    </article>
  );
}
