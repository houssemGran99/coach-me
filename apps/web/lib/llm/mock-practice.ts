import type { LlmRequest } from "./types";

/** Filled in with the practice chat in step 10. */
export async function mockPracticeReply(_req: LlmRequest): Promise<unknown> {
  return { error: { code: "NO_SUITABLE_DRILLS", message: "Not implemented yet." } };
}
