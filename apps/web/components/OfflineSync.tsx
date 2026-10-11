"use client";

import { useEffect } from "react";
import { cacheLibrary, rememberLastViewed, type CachedPractice } from "@/lib/offline";

/** Keeps the offline copy of the library fresh whenever the library is viewed online. */
export function OfflineSync({ owner, items }: { owner: string; items: CachedPractice[] }) {
  useEffect(() => {
    void cacheLibrary(owner, items);
  }, [owner, items]);
  return null;
}

/** Remembers the last practice viewed so it opens without a network. */
export function RememberPractice({ item }: { item: CachedPractice }) {
  useEffect(() => {
    void rememberLastViewed(item);
  }, [item]);
  return null;
}
