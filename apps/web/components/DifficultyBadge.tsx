import { useTranslations } from "next-intl";

/** Difficulty of a practice as three dots plus a word, so it does not rely on colour alone. */
export function DifficultyBadge({ level }: { level?: number }) {
  const t = useTranslations("difficulty");
  if (level !== 1 && level !== 2 && level !== 3) return null;
  return (
    <span className="tag inline-flex items-center gap-1.5" data-testid="difficulty" data-level={level} title={t("label")}>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`inline-block size-2 rounded-full ${n <= level ? "bg-ink" : "bg-line"}`} />
        ))}
      </span>
      <span className="sr-only">{t("label")}: </span>
      {t(String(level) as "1" | "2" | "3")}
    </span>
  );
}
