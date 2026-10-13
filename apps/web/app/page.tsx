import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Home() {
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
