"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** "Report this practice": stored for review, nothing is emailed in v1. */
export function ReportForm({ sharedId }: { sharedId: string }) {
  const t = useTranslations("public");
  const common = useTranslations("common");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch(`/api/share/${sharedId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold" data-testid="report-open">{t("report")}</summary>
      <form onSubmit={send} className="mt-2 grid max-w-md gap-3">
        <div className="field">
          <label htmlFor="report-reason">{t("reportReason")}</label>
          <textarea id="report-reason" className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-sm" disabled={state === "busy" || state === "sent"} data-testid="report-send">{t("sendReport")}</button>
          <span role="status" aria-live="polite">
            {state === "sent" ? t("reportThanks") : state === "error" ? common("genericError") : ""}
          </span>
        </div>
      </form>
    </details>
  );
}
