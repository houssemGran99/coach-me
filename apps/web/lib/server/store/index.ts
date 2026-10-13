import "server-only";
import { getConfig } from "../config";
import { createMemoryState, createMemoryStore } from "./memory";
import { connectMongo, createMongoStore } from "./mongo";
import type { Store } from "./types";

type G = typeof globalThis & { __mourabbiMemory?: ReturnType<typeof createMemoryState> };

/** The store for the current request: in-memory when MOCK_BACKEND=1, MongoDB when MONGODB_URI is set, otherwise nothing is configured and it throws. */
export async function getStore(): Promise<Store> {
  const cfg = getConfig();
  if (cfg.mockBackend) {
    // One state per server process, kept across hot reloads.
    const g = globalThis as G;
    g.__mourabbiMemory ??= createMemoryState();
    return createMemoryStore(g.__mourabbiMemory);
  }
  if (cfg.backend === "mongo") return createMongoStore(connectMongo(cfg.mongoUri, cfg.mongoDb));
  throw new Error("No database configured: set MONGODB_URI (or MOCK_BACKEND=1 for local development).");
}

export type { Store } from "./types";
