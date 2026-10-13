import { useTranslations } from "next-intl";
import type { Practice } from "@mourabbi/schemas";
import { ageLabel } from "@/lib/locale";
import { DifficultyBadge } from "./DifficultyBadge";

const KIND_CLASS: Record<Practice["kind"], string> = {
  warmup: "k-prep", cooldown: "k-prep", technical: "k-skill", main: "k-skill", game_related: "k-game", game: "k-game",
};

/** Kind, ages, players and area of a practice as a compact row. */
export function PracticeMeta({ practice }: { practice: Pick<Practice, "kind" | "difficulty" | "ageGroups" | "minPlayers" | "maxPlayers" | "area"> }) {
  const t = useTranslations();
  const senior = t("ages.senior");
  const first = ageLabel(practice.ageGroups[0]!, senior);
  const last = ageLabel(practice.ageGroups[practice.ageGroups.length - 1]!, senior);
  const ages = first === last ? first : t("templates.ageRange", { from: first, to: last });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className={`kind font-semibold uppercase tracking-wider ${KIND_CLASS[practice.kind]}`}>{t(`kinds.${practice.kind}`)}</span>
      <DifficultyBadge level={practice.difficulty} />
      <span className="tag">{ages}</span>
      <span className="tag">{t("common.playersRange", { min: practice.minPlayers, max: practice.maxPlayers })}</span>
      <span className="tag">{t("common.area", { l: practice.area.lengthM, w: practice.area.widthM })}</span>
    </div>
  );
}
