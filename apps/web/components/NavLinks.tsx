"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const ITEMS = [
  { href: "/plan/new", key: "plan", match: "/plan" },
  { href: "/practice/new", key: "practice", match: "/practice" },
  { href: "/templates", key: "templates", match: "/templates" },
  { href: "/library", key: "library", match: "/library" },
] as const;

export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("menu")} className="-mx-1 flex flex-wrap gap-x-1 gap-y-1">
      {ITEMS.map((i) => {
        const active = pathname === i.match || pathname.startsWith(`${i.match}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold no-underline ${
              active ? "bg-ink text-bg" : "hover:bg-surface-2"
            }`}
          >
            {t(i.key)}
          </Link>
        );
      })}
    </nav>
  );
}
