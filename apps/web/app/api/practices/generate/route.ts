import { getLocale } from "next-intl/server";
import { PracticeSchema, z, type Lang, type Practice } from "@mourabbi/schemas";
import { validateSpec } from "@mourabbi/animation";
import { getLlm } from "@/lib/llm";
import { MAX_MESSAGE, generatePractice, type PracticeEvent } from "@/lib/server/generate-practice";
import { apiError, authed, readJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const maxDuration = 180;

const Body = z.strictObject({
  message: z.string().trim().min(1).max(MAX_MESSAGE),
  /** The draft being refined, as the client holds it (revalidated here). */
  previous: z.unknown().optional(),
  /** Or a saved library practice to refine. */
  from: z.uuid().optional(),
});

/** Streams newline-delimited JSON events: stages, then one result or one error. */
export async function POST(request: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const store = await getStore();
  let previous: Practice | null = null;
  if (body.data.from) {
    previous = (await store.getPractice(a.user.id, body.data.from))?.data ?? null;
    if (!previous) return apiError("NOT_FOUND", 404);
  } else if (body.data.previous != null) {
    const p = PracticeSchema.safeParse(body.data.previous);
    if (!p.success || validateSpec(p.data.animation, p.data.area).length) return apiError("INVALID_INPUT", 400);
    previous = p.data;
  }

  const uiLang = (await getLocale()) as Lang;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: PracticeEvent) => controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      try {
        for await (const ev of generatePractice({ llm: getLlm(), store }, a.user.id, { message: body.data.message, uiLang, previous })) send(ev);
      } catch (e) {
        console.error("practice generation failed:", (e as Error).message);
        send({ type: "error", code: "SERVER", message: "" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
