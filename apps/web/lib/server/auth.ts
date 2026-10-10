import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "./config";
import { supabaseUser } from "./supabase";

export interface AppUser {
  id: string;
  email: string;
}

export const MOCK_COOKIE = "mock_user";

/** Stable uuid-shaped id for a mock user, derived from the email. */
export function mockUserId(email: string): string {
  const h = createHash("sha1").update(email.trim().toLowerCase()).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function encodeMockCookie(email: string): string {
  return Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
}

export function decodeMockCookie(value: string | undefined): AppUser | null {
  if (!value) return null;
  try {
    const email = Buffer.from(value, "base64url").toString("utf8");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
    return { id: mockUserId(email), email };
  } catch {
    return null;
  }
}

/** The signed-in user, or null. Uses the in-memory mock only when the mock backend is enabled. */
export async function getUser(): Promise<AppUser | null> {
  const cfg = getConfig();
  if (cfg.mockBackend) return decodeMockCookie((await cookies()).get(MOCK_COOKIE)?.value);
  if (!cfg.supabaseUrl) return null;
  const sb = await supabaseUser();
  const { data } = await sb.auth.getUser();
  return data.user?.email ? { id: data.user.id, email: data.user.email } : null;
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback = "/plan/new"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export async function requireUser(returnTo: string): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
