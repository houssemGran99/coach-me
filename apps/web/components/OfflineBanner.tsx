"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Shown while the browser is offline. */
export function OfflineBanner() {
  const t = useTranslations("common");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="banner banner-warn m-3 text-center" data-testid="offline-banner">
      {t("offline")}
    </div>
  );
}
