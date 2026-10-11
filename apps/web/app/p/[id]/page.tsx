import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PracticeView } from "@/components/PracticeView";
import { ReportForm } from "@/components/ReportForm";
import { SaveSharedButton } from "@/components/SaveSharedButton";
import type { Locale } from "@/i18n/config";
import { getUser } from "@/lib/server/auth";
import { readPublicShare } from "@/lib/server/share";
import { getStore } from "@/lib/server/store";

// One read (and one view count) per request, shared by the metadata and the page.
const load = cache(async (id: string) => readPublicShare(await getStore(), id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await load(id);
  const locale = (await getLocale()) as Locale;
  const robots = { index: false, follow: false };
  if (!p) return { title: (await getTranslations("public"))("gone"), robots };
  return {
    title: p.name[locale],
    description: p.organisation[locale].slice(0, 160),
    robots,
    openGraph: { title: p.name[locale], description: p.organisation[locale].slice(0, 160), type: "article" },
  };
}

export default async function SharedPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const practice = await load(id);
  if (!practice) notFound();
  const t = await getTranslations("public");
  const signedIn = !!(await getUser());

  return (
    <div className="grid gap-6">
      <p className="eyebrow">{t("shared")}</p>
      <PracticeView practice={practice} headings="public" actions={<SaveSharedButton sharedId={id} signedIn={signedIn} />}>
        {practice.source === "ai" && practice.review.status === "ai_draft" && (
          <p className="banner banner-warn" data-testid="ai-note">{(await getTranslations("share"))("aiNote")}</p>
        )}
        <ReportForm sharedId={id} />
      </PracticeView>
      <p className="muted text-sm">
        {t("madeWith")} · <Link href="/" className="font-semibold">{t("openApp")}</Link>
      </p>
    </div>
  );
}
