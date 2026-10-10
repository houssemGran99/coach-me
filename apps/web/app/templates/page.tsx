import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AGE_GROUPS, EQUIPMENT, PRACTICE_KINDS, THEMES } from "@mourabbi/schemas";
import { PracticeCard } from "@/components/PracticeCard";
import { filterPractices, getTemplates, parseFilters } from "@/lib/templates";
import { ageLabel } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations();
  await getLocale();
  const params = await searchParams;
  const f = parseFilters(params);
  const all = getTemplates();
  const list = filterPractices(all, f);
  const hasFilters = Object.entries(f).some(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ""));

  return (
    <div className="grid gap-6">
      <header className="grid max-w-3xl gap-2">
        <h1 className="display text-5xl leading-none">{t("templates.title")}</h1>
        <p className="muted">{t("templates.intro")}</p>
      </header>

      <form method="get" action="/templates" className="card grid gap-4" role="search" aria-label={t("templates.searchLabel")}>
        <div className="field">
          <label htmlFor="q">{t("templates.searchLabel")}</label>
          <input id="q" name="q" type="search" className="input" defaultValue={f.q ?? ""} placeholder={t("templates.searchPlaceholder")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label htmlFor="kind">{t("templates.kind")}</label>
            <select id="kind" name="kind" className="select" defaultValue={f.kind ?? ""}>
              <option value="">{t("common.all")}</option>
              {PRACTICE_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
            </select>
          </div>
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
        </div>
        <fieldset className="field border-0 p-0">
          <legend className="lab mb-1 text-xs font-semibold uppercase tracking-wider muted">{t("templates.equipment")}</legend>
          <div className="chips">
            {EQUIPMENT.map((e) => (
              <label key={e} className="chip">
                <input type="checkbox" name="equip" value={e} defaultChecked={f.equipment?.includes(e)} />
                <span>{t(`equipment.${e}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="field">
            <label htmlFor="l">{t("templates.areaLength")}</label>
            <input id="l" name="l" type="number" inputMode="numeric" min={5} max={200} className="input" defaultValue={f.lengthM ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="w">{t("templates.areaWidth")}</label>
            <input id="w" name="w" type="number" inputMode="numeric" min={5} max={200} className="input" defaultValue={f.widthM ?? ""} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-solid">{t("common.apply")}</button>
          {hasFilters && <a href="/templates" className="btn">{t("common.reset")}</a>}
        </div>
      </form>

      <p className="muted text-sm" role="status" data-testid="result-count">{t("templates.results", { n: list.length })}</p>
      {list.length === 0 ? (
        <p className="banner">{t("templates.noResults")}</p>
      ) : (
        <ul className="grid-cards">
          {list.map((p) => (
            <PracticeCard key={p.id} practice={p} href={`/templates/${p.id}`} />
          ))}
        </ul>
      )}
    </div>
  );
}
