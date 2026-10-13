"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "@mourabbi/schemas";
import { MOCK_COOKIE, encodeMockCookie, safeNext } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";

export interface LoginState {
  status: "idle" | "sent" | "error";
  error?: "invalidEmail" | "failed";
}

/** Email sign-in exists only in mock mode (any address signs in directly). Real deployments use automatic guest accounts. */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().toLowerCase().pipe(z.email().max(254)).safeParse(String(form.get("email") ?? ""));
  if (!email.success) return { status: "error", error: "invalidEmail" };
  const next = safeNext(String(form.get("next") ?? ""));
  const cfg = getConfig();

  if (cfg.mockBackend) {
    (await cookies()).set(MOCK_COOKIE, encodeMockCookie(email.data), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  return { status: "error", error: "failed" };
}
