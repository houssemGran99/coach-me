import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PitchPreview } from "@mourabbi/animation";
import type { Practice } from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";
import { PracticeMeta } from "./PracticeMeta";
import { TrustBadge } from "./TrustBadge";

/** Gallery card with a static pitch preview rendered from the animation (middle of step 1). */
export function PracticeCard({ practice, href }: { practice: Practice; href: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const name = practice.name[locale];
  return (
    <li className="card card-hover flex flex-col gap-3 !p-3" data-testid="practice-card">
      <Link href={href} className="card-media" aria-label={name}>
        <PitchPreview
          spec={practice.animation}
          area={practice.area}
          lang={locale}
          title={t("templates.cardPreview", { name })}
        />
      </Link>
      <div className="grid gap-2">
        <h3 className="display text-xl leading-tight">
          <Link href={href} className="no-underline">{name}</Link>
        </h3>
        <PracticeMeta practice={practice} />
        <div><TrustBadge practice={practice} /></div>
      </div>
    </li>
  );
}
