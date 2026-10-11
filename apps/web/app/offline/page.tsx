import type { Metadata } from "next";
import { OfflineLibrary } from "@/components/OfflineLibrary";

export const metadata: Metadata = { robots: { index: false } };

/** Precached by the service worker and shown when a page cannot be reached. */
export default function OfflinePage() {
  return <OfflineLibrary />;
}
