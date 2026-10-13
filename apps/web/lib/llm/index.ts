import "server-only";
import { getConfig } from "../server/config";
import { createAnthropicLlm } from "./anthropic";
import { createGeminiLlm } from "./gemini";
import { createMockLlm } from "./mock";
import { LlmUnavailableError, type Llm } from "./types";

export * from "./types";

/** The model provider for this process. The key and model name come from the environment and never reach the client. */
export function getLlm(): Llm {
  const cfg = getConfig();
  if (cfg.mockLlm) return createMockLlm();
  if (!cfg.llmApiKey) {
    return {
      async completeJson() {
        throw new LlmUnavailableError("LLM_API_KEY is not set");
      },
    };
  }
  if (cfg.llmProvider === "gemini") return createGeminiLlm({ apiKey: cfg.llmApiKey, model: cfg.llmModel || "gemini-2.5-flash" });
  return createAnthropicLlm({ apiKey: cfg.llmApiKey, model: cfg.llmModel || "claude-sonnet-5-5" });
}
