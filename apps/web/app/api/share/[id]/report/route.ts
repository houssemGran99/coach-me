import { NextResponse } from "next/server";
import { z } from "@mourabbi/schemas";
import { apiError, readJson } from "@/lib/server/http";
import { SHARE_ID, allowReport } from "@/lib/server/share";
import { getStore } from "@/lib/server/store";

const Body = z.strictObject({ reason: z.string().trim().max(500).optional() });

/** Anyone can report a shared practice. Stored in `reports`; no email is sent in v1. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHARE_ID.test(id)) return apiError("NOT_FOUND", 404);
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (!allowReport(ip)) return apiError("RATE_LIMITED", 429);
  const body = Body.safeParse((await readJson(request, 5_000)) ?? {});
  if (!body.success) return apiError("INVALID_INPUT", 400);
  const store = await getStore();
  // Same answer whether or not the link exists, so reports cannot be used to probe ids.
  if (await store.getShare(id)) await store.addReport(id, body.data.reason || null);
  return NextResponse.json({ ok: true });
}
