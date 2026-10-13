import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { AppUser } from "@/lib/server/auth";
import { LanguageSwitch } from "./LanguageSwitch";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

export async function Header({ user }: { user: AppUser | null }) {
  const t = await getTranslations("nav");
  const brand = (await getTranslations("common"))("brand");
  return (
    <header className="border-b border-line bg-bg">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
        <Link href="/" className="display inline-flex min-h-11 min-w-11 items-center text-3xl tracking-[0.08em] no-underline">{brand}</Link>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <LanguageSwitch />
          </Suspense>
          {user && !user.isGuest ? (
            <SignOutButton email={user.email} />
          ) : (
            <Link href="/login" className="btn btn-sm">{t("signIn")}</Link>
          )}
        </div>
        <div className="w-full">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}
