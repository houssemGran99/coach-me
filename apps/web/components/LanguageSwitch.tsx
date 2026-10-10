"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES } from "@/i18n/config";

/** Links with ?lang=xx; the proxy stores the choice in a cookie and removes the parameter. */
export function LanguageSwitch() {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const hrefFor = (l: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("lang", l);
    return `${pathname}?${p.toString()}`;
  };
  return (
    <div role="group" aria-label={t("language")} className="inline-flex overflow-hidden rounded-md border border-line bg-surface">
      {LOCALES.map((l) => (
        // Plain anchors: a full navigation lets the proxy set the cookie and re-render the whole page in the new language/direction.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          key={l}
          href={hrefFor(l)}
          lang={l}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className={`inline-flex min-h-11 min-w-12 items-center justify-center text-sm font-semibold uppercase no-underline ${
            l === current ? "bg-ink text-bg" : ""
          }`}
        >
          {l}
        </a>
      ))}
    </div>
  );
}
