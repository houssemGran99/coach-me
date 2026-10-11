import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatPractice } from "@/components/ChatPractice";
import { requireUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("chat"))("title") };
}

export default async function NewPracticePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const user = await requireUser(from ? `/practice/new?from=${encodeURIComponent(from)}` : "/practice/new");
  const t = await getTranslations("chat");
  // "Ask for a change in chat" starts from one of the user's saved practices.
  const row = from && /^[0-9a-f-]{36}$/i.test(from) ? await (await getStore()).getPractice(user.id, from) : null;

  return (
    <div className="grid max-w-4xl gap-5">
      <header className="grid max-w-2xl gap-2">
        <h1 className="display text-5xl leading-none">{t("title")}</h1>
        <p className="muted">{t("intro")}</p>
      </header>
      <ChatPractice key={row?.id ?? "new"} fromLibrary={row ? { id: row.id, practice: row.data } : undefined} />
    </div>
  );
}
