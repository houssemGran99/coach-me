import { useTranslations } from "next-intl";
import { trustLabel, type Practice } from "@mourabbi/schemas";

/** Shows who stands behind a practice. Never shows "Reviewed" unless a named coach approved it. */
export function TrustBadge({ practice }: { practice: Pick<Practice, "review" | "source"> }) {
  const t = useTranslations("trust");
  const label = trustLabel(practice);
  if (label === "reviewed") {
    return (
      <span className="badge badge-ok" data-trust="reviewed">
        {t("reviewed", { name: practice.review.reviewedBy ?? "" })}
      </span>
    );
  }
  if (label === "ai_draft") {
    return (
      <span className="badge badge-ai" data-trust="ai_draft" title={t("aiHelp")}>
        {t("aiDraft")}
      </span>
    );
  }
  if (label === "edited_by_owner") {
    return (
      <span className="badge" data-trust="edited_by_owner">
        {t("edited")}
      </span>
    );
  }
  return (
    <span className="badge" data-trust="pending">
      {t("pending")}
    </span>
  );
}
