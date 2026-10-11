import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { LibraryActions } from "@/components/LibraryActions";
import { RememberPractice } from "@/components/OfflineSync";
import { PracticeView } from "@/components/PracticeView";
import { ShareDialog } from "@/components/ShareDialog";
import type { Locale } from "@/i18n/config";
import { getUser, requireUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";

const load = cache(async (owner: string, id: string) => (await getStore()).getPractice(owner, id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser();
  const row = user ? await load(user.id, id) : null;
  const locale = (await getLocale()) as Locale;
  return { title: row ? row.data.name[locale] : (await getTranslations("library"))("title") };
}

export default async function LibraryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/library/${id}`);
  const row = await load(user.id, id);
  if (!row) notFound();
  const t = await getTranslations("library");
  const locale = (await getLocale()) as Locale;
  const title = row.data.name[locale];

  return (
    <div className="grid gap-4">
      <RememberPractice item={{ id: row.id, title, practice: row.data, notes: row.notes, source: row.source, created_at: row.created_at }} />
      <Link href="/library" className="text-sm font-semibold">← {t("title")}</Link>
      <PracticeView practice={row.data} title={title}>
        {row.parent_template_id && <p className="hint">{t("fromTemplate", { id: row.parent_template_id })}</p>}
        <LibraryActions
          id={row.id}
          title={title}
          organisation={row.data.organisation[locale]}
          notes={row.notes}
          isAiDraft={row.data.review.status === "ai_draft"}
        >
          <ShareDialog practiceId={row.id} name={title} signedIn returnTo={`/library/${row.id}`} aiDraft={row.data.review.status === "ai_draft"} />
        </LibraryActions>
      </PracticeView>
    </div>
  );
}
