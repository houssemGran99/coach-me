import { LlmUnavailableError, extractJson, type Llm, type LlmRequest } from "./types";

interface Options {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Finish reasons that mean the model declined to answer. */
const REFUSED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);

/**
 * Google Gemini over fetch (generateContent, no SDK dependency). Server-only.
 * The key travels in a header, never in the URL, and JSON mode keeps replies parseable.
 */
export function createGeminiLlm({
  apiKey,
  model,
  fetchImpl = fetch,
  baseUrl = "https://generativelanguage.googleapis.com",
}: Options): Llm {
  return {
    async completeJson(req: LlmRequest) {
      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: {
          temperature: 0.2,
          // Thinking tokens count against this limit, so leave room beyond the visible answer.
          maxOutputTokens: (req.maxTokens ?? (req.task === "practice" ? 8000 : 2000)) * 2,
          responseMimeType: "application/json",
        },
      };

      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
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
      const json = (await res.json()) as GeminiReply;
      const candidate = json.candidates?.[0];
      if (json.promptFeedback?.blockReason || (candidate?.finishReason && REFUSED.has(candidate.finishReason))) {
        return { error: { code: "OUT_OF_SCOPE", message: "Refused." } };
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("");
      return extractJson(text);
    },
  };
}
