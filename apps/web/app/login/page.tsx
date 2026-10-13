import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUser, safeNext } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("loginTitle") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  // Only mock mode has an email sign-in: elsewhere visitors are guests, so send them straight to the feature.
  if ((await getUser()) || getConfig().backend !== "mock") redirect(dest);
  const t = await getTranslations("auth");
  return (
    <div className="grid gap-4">
      <h1 className="display text-5xl leading-none">{t("loginTitle")}</h1>
      <p className="muted max-w-[52ch]">{t("loginIntro")}</p>
      <LoginForm next={dest} mock={getConfig().mockBackend} />
    </div>
  );
}
