import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Practice } from "@mourabbi/schemas";
import { PlanForm } from "@/components/PlanForm";
import { SessionEditor } from "@/components/SessionEditor";
import type { Locale } from "@/i18n/config";
import { getConfig } from "@/lib/server/config";
import { getUser, requireUser } from "@/lib/server/auth";
import { loadPool } from "@/lib/server/pool";
import { getStore } from "@/lib/server/store";

const loadSession = cache(async (owner: string, id: string) => (await getStore()).getSession(owner, id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser();
  const row = user ? await loadSession(user.id, id) : null;
  const t = await getTranslations();
  return { title: row ? t("plan.sessionFor", { age: row.data.meta.ageGroup === "senior" ? t("ages.senior") : row.data.meta.ageGroup }) : t("nav.plan") };
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/plan/${id}`);
  const store = await getStore();
  const row = await loadSession(user.id, id);
  if (!row) notFound();
  const t = await getTranslations("plan");
  const locale = (await getLocale()) as Locale;

  const pool = await loadPool(store, user.id);
  const practices: Record<string, Practice> = {};
  for (const ph of row.data.phases) {
    const p = pool.lookup(ph.practiceId);
    if (p) practices[p.id] = p;
  }
  const mine = await store.listPractices(user.id);
  const titles = Object.fromEntries(mine.map((r) => [r.id, r.data.name[locale]]));
  const request = { meta: row.data.meta, focus: row.data.focus };

  return (
    <div className="grid gap-8">
      <SessionEditor
        session={{ ...row.data, reflection: row.reflection ?? row.data.reflection }}
        practices={practices}
        titles={titles}
        libraryIds={[...pool.libraryIds]}
        libraryFull={mine.length >= getConfig().freeLibraryLimit}
        locale={locale}
      />
      <section className="card" aria-label={t("squad")}>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("squad")}</summary>
          <div className="mt-3 max-w-2xl">
            <PlanForm locale={locale} initial={request} generatedFrom={request} submitLabel={t("generateAgain")} />
          </div>
        </details>
      </section>
    </div>
  );
}
