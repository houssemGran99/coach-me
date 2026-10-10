import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("legal"))("termsTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const items = t.raw("terms") as string[];
  return (
    <article className="grid max-w-2xl gap-4">
      <h1 className="display text-5xl leading-none">{t("termsTitle")}</h1>
      <p className="banner banner-warn">{t("draftNotice")}</p>
      {items.map((p) => <p key={p}>{p}</p>)}
    </article>
  );
}
