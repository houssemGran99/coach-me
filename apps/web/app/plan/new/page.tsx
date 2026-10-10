import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { SessionRequest } from "@mourabbi/schemas";
import { PlanForm } from "@/components/PlanForm";
import type { Locale } from "@/i18n/config";
import { requireUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { getTemplate } from "@/lib/templates";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("plan"))("newTitle") };
}

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ include?: string }> }) {
  const { include } = await searchParams;
  const user = await requireUser(include ? `/plan/new?include=${encodeURIComponent(include)}` : "/plan/new");
  const t = await getTranslations("plan");
  const locale = (await getLocale()) as Locale;
  const profile = await (await getStore()).getProfile(user.id);
  const tpl = include ? getTemplate(include) : undefined;

  // Start from sensible values; a template pre-fills what it needs to fit.
  const initial: SessionRequest = {
    meta: {
      ageGroup: tpl && !tpl.ageGroups.includes(profile?.default_age_group ?? "U12") ? tpl.ageGroups[0]! : (profile?.default_age_group ?? "U12"),
      playerCount: tpl ? Math.min(Math.max(12, tpl.minPlayers), tpl.maxPlayers) : 12,
      availableMinutes: 90,
      space: { lengthM: Math.max(40, tpl?.area.lengthM ?? 0), widthM: Math.max(30, tpl?.area.widthM ?? 0), surface: "grass" },
      equipment: ["balls", "cones", "bibs", "mini_goals", "full_goals"],
      language: locale,
    },
    focus: { theme: tpl?.themes[0] ?? "width_and_support", sourceNote: "" },
  };

  return (
    <div className="grid max-w-2xl gap-5">
      <header className="grid gap-2">
        <h1 className="display text-5xl leading-none">{t("newTitle")}</h1>
        <p className="muted">{t("newIntro")}</p>
      </header>
      <div className="card">
        <PlanForm locale={locale} initial={initial} include={tpl?.id} />
      </div>
    </div>
  );
}
