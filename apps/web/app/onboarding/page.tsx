import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AGE_GROUPS } from "@mourabbi/schemas";
import { LOCALES } from "@/i18n/config";
import { ageLabel } from "@/lib/locale";
import { requireUser, safeNext } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { saveOnboarding } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("title") };
}

const LANG_NAMES: Record<string, string> = { fr: "Français", en: "English", de: "Deutsch" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const user = await requireUser(`/onboarding?next=${encodeURIComponent(dest)}`);
  const t = await getTranslations("onboarding");
  const tAge = await getTranslations("ages");
  const locale = await getLocale();
  const profile = await (await getStore()).getProfile(user.id);
  return (
    <div className="grid max-w-md gap-4">
      <h1 className="display text-5xl leading-none">{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <form action={saveOnboarding} className="card grid gap-4">
        <input type="hidden" name="next" value={dest} />
        <div className="field">
          <label htmlFor="language">{t("language")}</label>
          <select id="language" name="language" className="select" defaultValue={profile?.language ?? locale}>
            {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="age">{t("defaultAge")}</label>
          <select id="age" name="age" className="select" defaultValue={profile?.default_age_group ?? "U12"}>
            {AGE_GROUPS.map((a) => <option key={a} value={a}>{ageLabel(a, tAge("senior"))}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">{t("continue")}</button>
        <p className="hint">{t("privacy")}</p>
      </form>
    </div>
  );
}
