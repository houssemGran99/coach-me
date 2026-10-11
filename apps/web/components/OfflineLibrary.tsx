"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PracticePlayer } from "@mourabbi/animation";
import type { Locale } from "@/i18n/config";
import { getCachedLibrary, getLastViewed, type CachedPractice } from "@/lib/offline";

/**
 * Served by the service worker when a page cannot be fetched. Shows the copy kept on this device:
 * the practice in the URL when it is cached, otherwise the saved practices.
 */
export function OfflineLibrary() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [data, setData] = useState<{ items: CachedPractice[]; last?: CachedPractice; path: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [items, last] = await Promise.all([getCachedLibrary(), getLastViewed()]);
      if (alive) setData({ items, last, path: window.location.pathname });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <p className="muted">{t("common.loading")}</p>;
  const m = /^\/(?:library|templates)\/([^/]+)$/.exec(data.path);
  const item = m ? (data.items.find((i) => i.id === m[1]) ?? (data.last?.id === m[1] ? data.last : undefined)) : undefined;

  if (item) {
    const p = item.practice;
    return (
      <article className="grid gap-4" data-testid="offline-practice">
        <p className="banner banner-warn">{t("library.offlineCopy")}</p>
        <h1 className="display text-4xl leading-none">{p.name[locale]}</h1>
        <PracticePlayer practice={p} lang={locale} />
        <p className="max-w-[68ch]">{p.organisation[locale]}</p>
        <ul className="pts grid gap-1">{p.coachingPoints[locale].map((c) => <li key={c}>{c}</li>)}</ul>
        {item.notes && <p className="banner whitespace-pre-wrap">{item.notes}</p>}
      </article>
    );
  }

  return (
    <div className="grid gap-4" data-testid="offline-list">
      <p className="banner banner-warn">{t("common.offline")}</p>
      <h1 className="display text-5xl leading-none">{t("library.title")}</h1>
      {data.items.length === 0 && !data.last ? (
        <p className="banner">{t("library.empty")}</p>
      ) : (
        <ul className="grid">
          {data.last && !data.items.some((i) => i.id === data.last!.id) && (
            <li className="border-t border-line py-3 first:border-t-0">
              <Link href={`/templates/${data.last.id}`} className="display text-2xl no-underline">{data.last.practice.name[locale]}</Link>
            </li>
          )}
          {data.items.map((i) => (
            <li key={i.id} className="border-t border-line py-3 first:border-t-0">
              <Link href={`/library/${i.id}`} className="display text-2xl no-underline">{i.practice.name[locale]}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
