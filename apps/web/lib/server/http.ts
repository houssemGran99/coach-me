import "server-only";
import { NextResponse } from "next/server";
import { getUser, type AppUser } from "./auth";

export type ApiErrorCode =
  | "NO_SUITABLE_DRILLS" | "CONSTRAINTS_CONFLICT" | "OUT_OF_SCOPE" | "RATE_LIMITED" | "UNAUTHENTICATED"
  | "INVALID_INPUT" | "ALREADY_SHARED" | "LLM_UNAVAILABLE" | "NOT_FOUND" | "LIBRARY_FULL" | "SERVER";

/** Uniform error body: the client maps `code` to a message in the coach's language. */
export function apiError(code: ApiErrorCode, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, ...extra } }, { status });
}

/** Returns the signed-in user or a ready-made 401 response. */
export async function authed(): Promise<{ user: AppUser } | { response: NextResponse }> {
  const user = await getUser();
  if (!user) return { response: apiError("UNAUTHENTICATED", 401) };
  return { user };
}

/** Parse a JSON body of bounded size; returns undefined when it is missing or malformed. */
export async function readJson(request: Request, maxBytes = 200_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
