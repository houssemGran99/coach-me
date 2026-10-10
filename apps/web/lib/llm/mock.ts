import { buildFallbackSession, type Practice, type SessionRequest } from "@mourabbi/schemas";
import type { Llm, LlmRequest } from "./types";

export interface MockSessionContext {
  request: SessionRequest;
  practices: Practice[];
  includePracticeId?: string;
}

/**
 * Deterministic stand-in for the model, used when MOCK_BACKEND=1 or LLM_PROVIDER=mock
 * (local development and end-to-end tests). It follows the same output contract as the real model.
 */
export function createMockLlm(): Llm {
  return {
    async completeJson(req: LlmRequest) {
      if (req.task === "session") {
        const ctx = req.context as MockSessionContext;
        const pin = ctx.practices.find((p) => p.id === ctx.includePracticeId);
        const built = buildFallbackSession(ctx.request, ctx.practices, { id: "00000000-0000-4000-8000-000000000000", now: new Date(0).toISOString() }, { pin });
        if (built.status === "error") return { error: built.error };
        return {
          totalDurationMinutes: built.session.totalDurationMinutes,
          phases: built.session.phases.map((p) => ({ practiceId: p.practiceId, durationMinutes: p.durationMinutes })),
        };
      }
      const { mockPracticeReply } = await import("./mock-practice");
      return mockPracticeReply(req);
    },
  };
}
