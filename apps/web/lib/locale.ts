import type { AgeGroup, Lang } from "@mourabbi/schemas";
import type { Locale } from "@/i18n/config";

export const asLang = (l: Locale): Lang => l;

/** U-groups are the same in every language; "senior" is translated. */
export const ageLabel = (age: AgeGroup, senior: string): string => (age === "senior" ? senior : age);
