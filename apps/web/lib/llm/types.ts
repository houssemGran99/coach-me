/**
 * One provider behind one small interface. The rest of the app never sees keys, model names or HTTP.
 */
export interface LlmRequest {
  task: "session" | "practice";
  system: string;
  /** User-controlled text is always inside delimited blocks in here. */
  user: string;
  maxTokens?: number;
  /** Structured inputs for the mock provider only; real providers ignore it. */
  context?: unknown;
}

export interface Llm {
  /**
   * Returns the parsed JSON object when the model produced one, or the raw text when it did not
   * (the caller's schema validation then rejects it and the retry loop takes over).
   * Throws LlmUnavailableError when the provider cannot be reached.
   */
  completeJson(req: LlmRequest): Promise<unknown>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

/** Pull one JSON object out of a model reply, tolerating code fences and stray prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1]! : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const a = body.indexOf("{");
    const b = body.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(body.slice(a, b + 1));
      } catch {
        return text;
      }
    }
    return text;
  }
}
