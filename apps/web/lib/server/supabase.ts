import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getConfig } from "./config";

/** Client that acts as the signed-in user; Row Level Security applies to everything it does. */
export async function supabaseUser(): Promise<SupabaseClient> {
  const cfg = getConfig();
  const jar = await cookies();
  return createServerClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so use it only for the few server routes that must:
 * public share reads, generation logs, reports and rate-limit counts.
 */
export function supabaseAdmin(): SupabaseClient {
  const cfg = getConfig();
  admin ??= createClient(cfg.supabaseUrl, cfg.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
