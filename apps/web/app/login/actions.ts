"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "@mourabbi/schemas";
import { MOCK_COOKIE, encodeMockCookie, safeNext } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { supabaseUser } from "@/lib/server/supabase";

export interface LoginState {
  status: "idle" | "sent" | "error";
  error?: "invalidEmail" | "failed";
}

async function siteOrigin(): Promise<string> {
  const cfg = getConfig();
  if (cfg.siteUrl) return cfg.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Email magic link only. In mock mode any address signs in directly. */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().toLowerCase().pipe(z.email().max(254)).safeParse(String(form.get("email") ?? ""));
  if (!email.success) return { status: "error", error: "invalidEmail" };
  const next = safeNext(String(form.get("next") ?? ""));
  const cfg = getConfig();

  if (cfg.mockBackend) {
    (await cookies()).set(MOCK_COOKIE, encodeMockCookie(email.data), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  const sb = await supabaseUser();
  const origin = await siteOrigin();
  const { error } = await sb.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { status: "error", error: "failed" };
  return { status: "sent" };
}
