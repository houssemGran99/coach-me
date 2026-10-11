// @ts-check
import { serwist } from "@serwist/next/config";

// Built after `next build` (configurator mode, works with Turbopack): `serwist build`.
export default serwist({
  swSrc: "sw/sw.ts",
  swDest: "public/sw.js",
  // Every page here depends on the signed-in user, so nothing prerendered is precached.
  precachePrerendered: false,
  // The page served when a navigation fails offline.
  additionalPrecacheEntries: [{ url: "/offline", revision: globalThis.crypto.randomUUID() }],
});
