import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { z, type Lang } from "@mourabbi/schemas";
import { apiError, authed, readJson } from "@/lib/server/http";
import { saveDraft, saveSharedCopy, saveTemplateCopy } from "@/lib/server/library";
import { getStore } from "@/lib/server/store";

const Body = z.union([
  z.strictObject({ sharedId: z.string().regex(/^[A-Za-z0-9_-]{12,64}$/) }),
  z.strictObject({ templateId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/) }),
  z.strictObject({ practice: z.unknown(), parentTemplateId: z.string().max(64).nullable().optional() }),
]);

/** Save a template or a chat result into the signed-in user's library (free tier cap applies). */
export async function POST(request: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const lang = (await getLocale()) as Lang;
  const store = await getStore();
  const res =
    "sharedId" in body.data
      ? await saveSharedCopy(store, a.user.id, body.data.sharedId, lang)
      : "templateId" in body.data
        ? await saveTemplateCopy(store, a.user.id, body.data.templateId, lang)
        : await saveDraft(store, a.user.id, body.data.practice, lang, body.data.parentTemplateId ?? null);

  if (!res.ok) {
    const status = res.code === "LIBRARY_FULL" ? 409 : res.code === "NOT_FOUND" ? 404 : 400;
    return apiError(res.code, status);
  }
  return NextResponse.json({ id: res.row.id }, { status: 201 });
}
