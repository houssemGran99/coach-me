import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Landing } from "@/components/landing/Landing";
import { getUser } from "@/lib/server/auth";

const TITLE = "Coach Me – Votre séance d'entraînement en 30 secondes";

/** Visitors who are not signed in see the marketing page; signed-in coaches get the app home. */
export async function generateMetadata(): Promise<Metadata> {
  if (await getUser()) return {};
  return {
    title: { absolute: TITLE },
    description:
      "Coach Me aide les entraîneurs de football de Tunisie à préparer une séance chronométrée à partir d'exercices relus, à les visionner en animation et à les partager par lien.",
    openGraph: {
      title: TITLE,
      description: "Des exercices animés, une séance chronométrée, un lien à partager. Pour les entraîneurs d'académies de football.",
      type: "website",
      locale: "fr_FR",
    },
  };
}

export default async function Home() {
  if (!(await getUser())) return <Landing />;

  const t = await getTranslations("home");
  return (
    <div className="grid gap-10">
      <section className="grid max-w-3xl gap-4 py-4">
        <h1 className="display text-5xl leading-[1.02] sm:text-7xl">{t("title")}</h1>
        <p className="muted max-w-[62ch] text-lg">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/plan/new" className="btn btn-primary">{t("ctaPlan")}</Link>
          <Link href="/practice/new" className="btn">{t("ctaPractice")}</Link>
          <Link href="/templates" className="btn">{t("ctaTemplates")}</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {(["f1", "f2", "f3"] as const).map((k) => (
          <div key={k} className="card grid gap-2">
            <h2 className="display text-2xl">{t(`${k}Title`)}</h2>
            <p className="muted">{t(`${k}Text`)}</p>
          </div>
        ))}
      </section>
      <p className="banner max-w-3xl">{t("honesty")}</p>
    </div>
  );
}
