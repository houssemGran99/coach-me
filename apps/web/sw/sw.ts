/// <reference lib="esnext" />
/// <reference lib="webworker" />
import {
  CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate,
  type PrecacheEntry, type RuntimeCaching, type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Cache policy: the app shell (precached build assets and the /offline page) and static media only.
 * Pages, API responses, generation responses and anything user-specific are NEVER cached here:
 * navigations always go to the network, and saved practices live in IndexedDB instead.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkOnly(), // on failure the /offline fallback below is served
  },
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 })],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && (request.destination === "image" || request.destination === "font"),
    handler: new StaleWhileRevalidate({
      cacheName: "media",
      plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
