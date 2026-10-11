import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Same message for unknown and revoked links. */
export default async function SharedNotFound() {
  const t = await getTranslations("public");
  return (
    <div className="grid max-w-xl gap-3" data-testid="share-gone">
      <h1 className="display text-5xl leading-none">{t("gone")}</h1>
      <p className="muted">{t("goneHelp")}</p>
      <p><Link href="/" className="btn">{t("openApp")}</Link></p>
    </div>
  );
}
