import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { apiError, authed } from "@/lib/server/http";
import { duplicatePractice } from "@/lib/server/library";
import { getStore } from "@/lib/server/store";

const SUFFIX: Record<string, string> = { en: "(copy)", fr: "(copie)", ar: "(نسخة)" };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { id } = await params;
  const res = await duplicatePractice(await getStore(), a.user.id, id, SUFFIX[await getLocale()] ?? "(copy)");
  if (!res.ok) return apiError(res.code, res.code === "LIBRARY_FULL" ? 409 : res.code === "NOT_FOUND" ? 404 : 400);
  return NextResponse.json({ id: res.row.id }, { status: 201 });
}
