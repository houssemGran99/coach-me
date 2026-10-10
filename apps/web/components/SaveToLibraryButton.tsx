"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  /** Template id to copy, or the id of an item already in the library. */
  practiceId: string;
  fromLibrary?: boolean;
  full?: boolean;
  /** Signed-out visitors are sent to sign in first. */
  signedIn?: boolean;
  className?: string;
}

/** Copies a template into the personal library. */
export function SaveToLibraryButton({ practiceId, fromLibrary, full, signedIn = true, className }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "saved" | "full" | "error">(full ? "full" : "idle");
  const [savedId, setSavedId] = useState<string | null>(null);

  if (fromLibrary) return <span className="tag self-center">{t("plan.inLibrary")}</span>;

  async function save() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/templates/${practiceId}`)}`);
      return;
    }
    setState("busy");
    try {
      const res = await fetch("/api/practices/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: practiceId }),
      });
      if (res.status === 401) return router.push(`/login?next=${encodeURIComponent(`/templates/${practiceId}`)}`);
      if (res.status === 409) return setState("full");
      if (!res.ok) return setState("error");
      const json = (await res.json()) as { id: string };
      setSavedId(json.id);
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={`btn btn-sm ${className ?? ""}`} onClick={save} disabled={state === "busy" || state === "saved" || state === "full"} data-testid="save-to-library">
        {t("templates.saveToLibrary")}
      </button>
      <span role="status" aria-live="polite" className="text-sm">
        {state === "saved" && (<>{t("templates.saved")} {savedId && <Link href={`/library/${savedId}`} className="font-semibold">{t("common.open")}</Link>}</>)}
        {state === "full" && t("errors.LIBRARY_FULL")}
        {state === "error" && t("errors.SERVER")}
      </span>
    </span>
  );
}
