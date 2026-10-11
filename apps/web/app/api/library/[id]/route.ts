import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { z, type Lang } from "@mourabbi/schemas";
import { apiError, authed, readJson } from "@/lib/server/http";
import { applyLibraryEdit } from "@/lib/server/library";
import { getStore } from "@/lib/server/store";

const Body = z.strictObject({
  title: z.string().trim().min(1).max(80).optional(),
  organisation: z.string().trim().min(1).max(600).optional(),
  notes: z.string().max(2000).optional(),
  /** The owner confirms an AI draft after checking it. */
  confirmDraft: z.literal(true).optional(),
});

/** Edit title, set-up text and private notes; confirm an AI draft. Movement is never edited here. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const store = await getStore();
  const row = await store.getPractice(a.user.id, id);
  if (!row) return apiError("NOT_FOUND", 404);
  const lang = (await getLocale()) as Lang;

  const next = applyLibraryEdit(row.data, { title: body.data.title, organisation: body.data.organisation, confirmDraft: body.data.confirmDraft }, lang);
  if (!next) return apiError("INVALID_INPUT", 400);

  const updated = await store.updatePractice(a.user.id, id, {
    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
    ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
    data: next,
    review_status: next.review.status,
  });
  if (!updated) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true, review_status: updated.review_status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { id } = await params;
  const ok = await (await getStore()).deletePractice(a.user.id, id);
  return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND", 404);
}
