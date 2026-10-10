import { NextResponse } from "next/server";
import { SessionRequestSchema, z } from "@mourabbi/schemas";
import { getLlm } from "@/lib/llm";
import { generateSession } from "@/lib/server/generate-session";
import { apiError, authed, readJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const maxDuration = 120;

const Body = z.strictObject({
  meta: SessionRequestSchema.shape.meta,
  focus: SessionRequestSchema.shape.focus,
  include: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
});

export async function POST(request: Request) {
  const a = await authed();
  if ("response" in a) return a.response;

  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError("INVALID_INPUT", 400);

  try {
    const result = await generateSession(
      { llm: getLlm(), store: await getStore() },
      a.user.id,
      { meta: parsed.data.meta, focus: parsed.data.focus, includePracticeId: parsed.data.include },
    );
    if (!result.ok) return apiError(result.code, result.status, { message: result.message });
    return NextResponse.json({ id: result.session.id, source: result.source });
  } catch (e) {
    console.error("generate failed:", (e as Error).message);
    return apiError("SERVER", 500);
  }
}
