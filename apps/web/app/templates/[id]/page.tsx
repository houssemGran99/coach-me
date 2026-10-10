import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PracticeView } from "@/components/PracticeView";
import type { Locale } from "@/i18n/config";
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
  return (
    <div className="grid gap-4">
      <Link href="/templates" className="text-sm font-semibold">← {t("backToList")}</Link>
      <PracticeView
        practice={practice}
        actions={
          <Link href={`/plan/new?include=${practice.id}`} className="btn btn-primary">{t("useInSession")}</Link>
        }
      />
    </div>
  );
}
