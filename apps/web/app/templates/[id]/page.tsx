import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { RememberPractice } from "@/components/OfflineSync";
import { PracticeView } from "@/components/PracticeView";
import { SaveToLibraryButton } from "@/components/SaveToLibraryButton";
import { ShareDialog } from "@/components/ShareDialog";
import type { Locale } from "@/i18n/config";
import { getUser } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { getStore } from "@/lib/server/store";
import { getTemplate } from "@/lib/templates";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getTemplate(id);
  const locale = (await getLocale()) as Locale;
  return { title: p ? p.name[locale] : "Mourabbi" };
}

export default async function TemplatePage({ params }: Props) {
  const { id } = await params;
  const practice = getTemplate(id);
  if (!practice) notFound();
  const t = await getTranslations("templates");
  const locale = (await getLocale()) as Locale;
  const user = await getUser();
  const full = user ? (await (await getStore()).countPractices(user.id)) >= getConfig().freeLibraryLimit : false;
  return (
    <div className="grid gap-4">
      <RememberPractice item={{ id: practice.id, title: practice.name[locale], practice, notes: "", source: "template", created_at: "" }} />
      <Link href="/templates" className="text-sm font-semibold"><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("backToList")}</Link>
      <PracticeView
        practice={practice}
        actions={
          <>
            <Link href={`/plan/new?include=${practice.id}`} className="btn btn-primary">{t("useInSession")}</Link>
            <SaveToLibraryButton practiceId={practice.id} signedIn={!!user} full={full} />
            <ShareDialog practiceId={practice.id} name={practice.name[locale]} signedIn={!!user} returnTo={`/templates/${practice.id}`} />
          </>
        }
      />
    </div>
  );
}
