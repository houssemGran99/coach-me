import { NextResponse } from "next/server";
import { apiError, authed } from "@/lib/server/http";
import { SHARE_ID, readPublicShare } from "@/lib/server/share";
import { getStore } from "@/lib/server/store";

/** Public read of a shared practice. No login. Unknown and revoked ids give the same 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const practice = await readPublicShare(await getStore(), id);
  if (!practice) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ practice }, { headers: { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" } });
}

/** Stop sharing: sets revoked_at. Only the owner can do this. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { id } = await params;
  if (!SHARE_ID.test(id)) return apiError("NOT_FOUND", 404);
  const ok = await (await getStore()).revokeShare(a.user.id, id);
  return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND", 404);
}
