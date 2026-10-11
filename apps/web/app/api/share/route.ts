import { NextResponse } from "next/server";
import { z } from "@mourabbi/schemas";
import { getConfig } from "@/lib/server/config";
import { apiError, authed, readJson } from "@/lib/server/http";
import { activeShare, shareLink } from "@/lib/server/share";
import { getStore } from "@/lib/server/store";

const Body = z.strictObject({
  practiceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  mode: z.enum(["update", "new"]).optional(),
});

/** Create a share link for a library practice or a template; or update/replace it with `mode`. */
export async function POST(request: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const res = await shareLink(await getStore(), a.user.id, body.data.practiceId, body.data.mode);
  if (!res.ok) {
    if (res.code === "ALREADY_SHARED") return apiError("ALREADY_SHARED", 409, { id: res.existingId });
    if (res.code === "RATE_LIMITED") return apiError("RATE_LIMITED", 429, { limit: getConfig().dailyShareLimit });
    return apiError("NOT_FOUND", 404);
  }
  return NextResponse.json({ id: res.id, updated: !!res.updated }, { status: res.updated ? 200 : 201 });
}

/** The current live link of a practice, for the share dialog. */
export async function GET(request: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const practiceId = new URL(request.url).searchParams.get("practiceId") ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(practiceId)) return apiError("INVALID_INPUT", 400);
  const share = await activeShare(await getStore(), a.user.id, practiceId);
  return NextResponse.json({ id: share?.id ?? null });
}
