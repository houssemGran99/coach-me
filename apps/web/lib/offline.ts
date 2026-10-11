"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Practice } from "@mourabbi/schemas";

/**
 * Offline cache in IndexedDB: the signed-in user's saved practices and the last practice they viewed.
 * Only that user's own data is stored; it is wiped on sign-out and when a different user signs in.
 */
export interface CachedPractice {
  id: string;
  title: string;
  practice: Practice;
  notes: string;
  source: Practice["source"];
  created_at: string;
}

interface MrbDB extends DBSchema {
  practices: { key: string; value: CachedPractice };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<MrbDB>> | null = null;

function db(): Promise<IDBPDatabase<MrbDB>> {
  dbp ??= openDB<MrbDB>("mourabbi", 1, {
    upgrade(d) {
      d.createObjectStore("practices", { keyPath: "id" });
      d.createObjectStore("meta", { keyPath: "key" });
    },
  });
  return dbp;
}

const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback; // IndexedDB can be unavailable (private mode, blocked storage)
  }
};

/** Replace the cached library with the user's current one. */
export function cacheLibrary(owner: string, items: CachedPractice[]): Promise<void> {
  return safe(async () => {
    const d = await db();
    const tx = d.transaction(["practices", "meta"], "readwrite");
    await tx.objectStore("practices").clear();
    for (const i of items) await tx.objectStore("practices").put(i);
    await tx.objectStore("meta").put({ key: "owner", value: owner });
    await tx.done;
  }, undefined);
}

export function getCachedLibrary(): Promise<CachedPractice[]> {
  return safe(async () => (await (await db()).getAll("practices")).sort((a, b) => b.created_at.localeCompare(a.created_at)), []);
}

export function getCachedPractice(id: string): Promise<CachedPractice | undefined> {
  return safe(async () => (await db()).get("practices", id), undefined);
}

export function rememberLastViewed(item: CachedPractice): Promise<void> {
  return safe(async () => {
    await (await db()).put("meta", { key: "last", value: item });
  }, undefined);
}

export function getLastViewed(): Promise<CachedPractice | undefined> {
  return safe(async () => ((await (await db()).get("meta", "last"))?.value as CachedPractice | undefined), undefined);
}

/** Remove everything: used on sign-out. */
export function clearOfflineData(): Promise<void> {
  return safe(async () => {
    const d = await db();
    await d.clear("practices");
    await d.clear("meta");
  }, undefined);
}
