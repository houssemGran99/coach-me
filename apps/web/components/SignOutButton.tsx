"use client";

import { useTranslations } from "next-intl";
import { clearOfflineData } from "@/lib/offline";

/** Wipes the on-device cache, then signs out. */
export function SignOutButton({ email }: { email: string }) {
  const t = useTranslations("nav");
  return (
    <form
      action="/api/auth/logout"
      method="post"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        await clearOfflineData();
        form.submit();
      }}
    >
      <button type="submit" className="btn btn-sm" title={email}>{t("signOut")}</button>
    </form>
  );
}
