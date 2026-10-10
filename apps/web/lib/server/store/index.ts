import "server-only";
import { getConfig } from "../config";
import { createMemoryState, createMemoryStore } from "./memory";
import { supabaseAdmin, supabaseUser } from "../supabase";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

type G = typeof globalThis & { __mourabbiMemory?: ReturnType<typeof createMemoryState> };

/** The store for the current request: in-memory when MOCK_BACKEND=1, otherwise Supabase. */
export async function getStore(): Promise<Store> {
  const cfg = getConfig();
  if (cfg.mockBackend) {
    // One state per server process, kept across hot reloads.
    const g = globalThis as G;
    g.__mourabbiMemory ??= createMemoryState();
    return createMemoryStore(g.__mourabbiMemory);
  }
  return createSupabaseStore(await supabaseUser(), supabaseAdmin());
}

export type { Store } from "./types";
