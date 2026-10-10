import { LlmUnavailableError, extractJson, type Llm, type LlmRequest } from "./types";

interface Options {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Models in the Claude 5 family reject non-default sampling parameters and take `effort`;
 * older models accept `temperature`. Brief: temperature 0.3 or lower.
 */
const isFiveFamily = (model: string) => /fable|mythos|(opus|sonnet|haiku)-5(-\d)?$/.test(model);

/** Anthropic Messages API over fetch (no SDK dependency). Server-only. */
export function createAnthropicLlm({ apiKey, model, fetchImpl = fetch, baseUrl = "https://api.anthropic.com" }: Options): Llm {
  return {
    async completeJson(req: LlmRequest) {
      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? (req.task === "practice" ? 8000 : 2000),
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      };
      if (isFiveFamily(model)) body.output_config = { effort: "medium" };
      else body.temperature = 0.2;

      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (e) {
        throw new LlmUnavailableError(`network: ${(e as Error).name}`);
      }
      if (!res.ok) {
        // Never log the key or the request body; the status is enough.
        throw new LlmUnavailableError(`provider returned ${res.status}`, res.status);
      }
      const json = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
      if (json.stop_reason === "refusal") return { error: { code: "OUT_OF_SCOPE", message: "Refused." } };
      const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      return extractJson(text);
    },
  };
}
