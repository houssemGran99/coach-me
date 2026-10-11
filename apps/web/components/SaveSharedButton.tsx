"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

/** "Save to my library" on the public page; signed-out visitors are asked to sign in first. */
export function SaveSharedButton({ sharedId, signedIn }: { sharedId: string; signedIn: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "saved" | "full" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(`/p/${sharedId}`)}`} data-testid="sign-in-to-save">
        {t("public.signInToSave")}
      </Link>
    );
  }

  async function save() {
    setState("busy");
    try {
      const res = await fetch("/api/practices/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sharedId }),
      });
      if (res.status === 401) return router.push(`/login?next=${encodeURIComponent(`/p/${sharedId}`)}`);
      if (res.status === 409) return setState("full");
      if (!res.ok) return setState("error");
      setSavedId(((await res.json()) as { id: string }).id);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-primary" onClick={save} disabled={state === "busy" || state === "saved"} data-testid="save-shared">
        {t("public.saveToLibrary")}
      </button>
      <span role="status" aria-live="polite" className="text-sm">
        {state === "saved" && (<>{t("templates.saved")} {savedId && <Link href={`/library/${savedId}`} className="font-semibold">{t("common.open")}</Link>}</>)}
        {state === "full" && t("errors.LIBRARY_FULL")}
        {state === "error" && t("errors.SERVER")}
      </span>
    </span>
  );
}
