import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AGE_GROUPS, THEMES } from "@mourabbi/schemas";
import { OfflineSync } from "@/components/OfflineSync";
import { PracticeCard } from "@/components/PracticeCard";
import { PracticeMeta } from "@/components/PracticeMeta";
import { TrustBadge } from "@/components/TrustBadge";
import type { Locale } from "@/i18n/config";
import { filterLibrary, parseLibraryFilters, type LibraryItem } from "@/lib/library-filter";
import { ageLabel } from "@/lib/locale";
import { requireUser } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { getStore } from "@/lib/server/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("library"))("title") };
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/library");
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const rows = await (await getStore()).listPractices(user.id);
  const max = getConfig().freeLibraryLimit;
  const f = parseLibraryFilters(await searchParams);

  const all: LibraryItem[] = rows.map((r) => ({ id: r.id, title: r.data.name[locale], data: r.data, source: r.source, created_at: r.created_at }));
  const list = filterLibrary(all, f);
  const cached = rows.map((r) => ({ id: r.id, title: r.data.name[locale], practice: r.data, notes: r.notes, source: r.source, created_at: r.created_at }));
  const active = Boolean(f.q || f.kind || f.age || f.theme || f.players || f.source);

  return (
    <div className="grid gap-6">
      <OfflineSync owner={user.id} items={cached} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="display text-5xl leading-none">{t("library.title")}</h1>
          <p className="muted text-sm" data-testid="library-cap">{t("library.cap", { n: rows.length, max })}</p>
        </div>
        <Link href="/practice/new" className="btn btn-primary">{t("nav.practice")}</Link>
      </header>
      {rows.length >= max && <p className="banner banner-warn" role="status">{t("library.capReached", { max })}</p>}

      {rows.length === 0 ? (
        <p className="banner">{t("library.empty")}</p>
      ) : (
        <>
          <form method="get" action="/library" className="card grid gap-4" role="search" aria-label={t("library.search")}>
            <div className="field">
              <label htmlFor="q">{t("library.search")}</label>
              <input id="q" name="q" type="search" className="input" defaultValue={f.q ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="field">
                <label htmlFor="age">{t("templates.age")}</label>
                <select id="age" name="age" className="select" defaultValue={f.age ?? ""}>
                  <option value="">{t("common.all")}</option>
                  {AGE_GROUPS.map((a) => <option key={a} value={a}>{ageLabel(a, t("ages.senior"))}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="theme">{t("templates.theme")}</label>
                <select id="theme" name="theme" className="select" defaultValue={f.theme ?? ""}>
                  <option value="">{t("common.all")}</option>
                  {THEMES.map((k) => <option key={k} value={k}>{t(`themes.${k}`)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="players">{t("templates.players")}</label>
                <input id="players" name="players" type="number" inputMode="numeric" min={1} max={60} className="input" defaultValue={f.players ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="source">{t("library.source")}</label>
                <select id="source" name="source" className="select" defaultValue={f.source ?? ""}>
                  <option value="">{t("common.all")}</option>
                  {(["template", "ai", "user"] as const).map((s) => <option key={s} value={s}>{t(`library.sources.${s}`)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sort">{t("library.sort")}</label>
                <select id="sort" name="sort" className="select" defaultValue={f.sort}>
                  <option value="newest">{t("library.newest")}</option>
                  <option value="name">{t("library.name")}</option>
                </select>
              </div>
            </div>
            <fieldset className="field border-0 p-0">
              <legend className="lab mb-1 text-xs font-semibold uppercase tracking-wider muted">{t("library.view")}</legend>
              <div className="chips">
                {(["list", "grid"] as const).map((v) => (
                  <label key={v} className="chip">
                    <input type="radio" name="view" value={v} defaultChecked={f.view === v} />
                    <span>{t(`library.${v}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-solid">{t("common.apply")}</button>
              {active && <Link href="/library" className="btn">{t("common.reset")}</Link>}
            </div>
          </form>

          <p className="muted text-sm" role="status" data-testid="result-count">{t("library.results", { n: list.length })}</p>
          {list.length === 0 ? (
            <p className="banner">{t("library.noResults")}</p>
          ) : f.view === "grid" ? (
            <ul className="grid-cards">
              {list.map((i) => <PracticeCard key={i.id} practice={i.data} href={`/library/${i.id}`} />)}
            </ul>
          ) : (
            <ul className="grid" data-testid="library-list">
              {list.map((i) => (
                <li key={i.id} className="grid gap-2 border-t border-line py-4 first:border-t-0" data-testid="library-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="display text-2xl leading-tight">
                      <Link href={`/library/${i.id}`} className="no-underline">{i.title}</Link>
                    </h2>
                    <TrustBadge practice={i.data} />
                  </div>
                  <PracticeMeta practice={i.data} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
