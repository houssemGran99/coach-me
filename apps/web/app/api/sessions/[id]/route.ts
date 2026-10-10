import { NextResponse } from "next/server";
import { ReflectionSchema, TrainingSessionSchema, z, type TrainingSession } from "@mourabbi/schemas";
import { apiError, authed, readJson } from "@/lib/server/http";
import { loadPool } from "@/lib/server/pool";
import { getStore } from "@/lib/server/store";

const Body = z.strictObject({
  phases: z
    .array(
      z.strictObject({
        practiceId: z.string().min(1).max(64),
        durationMinutes: z.number().int().min(3).max(45),
        note: z.string().max(500).optional(),
      }),
    )
    .min(3)
    .optional(),
  reflection: ReflectionSchema.optional(),
});

/** Edit durations, order and notes of a session, or save the after-session reflection. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const store = await getStore();
  const row = await store.getSession(a.user.id, id);
  if (!row) return apiError("NOT_FOUND", 404);

  let session: TrainingSession = row.data;
  if (body.data.phases) {
    // Only reorder, re-time and annotate the practices already in the session.
    const have = row.data.phases.map((p) => p.practiceId).sort().join("|");
    const want = body.data.phases.map((p) => p.practiceId).sort().join("|");
    if (have !== want) return apiError("INVALID_INPUT", 400);
    const pool = await loadPool(store, a.user.id);
    const phases = body.data.phases.map((p, i) => ({
      order: i + 1,
      practiceId: p.practiceId,
      kind: pool.lookup(p.practiceId)?.kind ?? row.data.phases.find((x) => x.practiceId === p.practiceId)!.kind,
      durationMinutes: p.durationMinutes,
      ...(p.note ? { note: p.note } : {}),
    }));
    session = { ...session, phases, totalDurationMinutes: phases.reduce((s, p) => s + p.durationMinutes, 0) };
  }
  if (body.data.reflection) session = { ...session, reflection: body.data.reflection };

  const checked = TrainingSessionSchema.safeParse(session);
  if (!checked.success) return apiError("INVALID_INPUT", 400);
  await store.upsertSession({ id, owner: a.user.id, data: checked.data, reflection: checked.data.reflection ?? null });
  return NextResponse.json({ ok: true, totalDurationMinutes: checked.data.totalDurationMinutes });
}
