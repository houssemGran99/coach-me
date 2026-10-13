import { describe, expect, it } from "vitest";
import { createGeminiLlm } from "./gemini";
import { LlmUnavailableError } from "./types";

function fakeFetch(reply: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const textReply = (t: string, finishReason = "STOP") => ({ candidates: [{ content: { parts: [{ text: t }] }, finishReason }] });
const req = { task: "session" as const, system: "SYS", user: "USER" };

describe("createGeminiLlm", () => {
  it("sends the key only as a header, the prompt as system/user, and asks for JSON", async () => {
    const f = fakeFetch(textReply('{"a":1}'));
    const out = await createGeminiLlm({ apiKey: "secret-key", model: "gemini-2.5-flash", fetchImpl: f.impl }).completeJson(req);
    expect(out).toEqual({ a: 1 });
    const { url, init } = f.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("SYS");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "USER" }] }]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBeLessThanOrEqual(0.3);
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("ignores thought parts and tolerates code fences", async () => {
    const f = fakeFetch({ candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: '```json\n{"b":2}\n```' }] } }] });
    expect(await createGeminiLlm({ apiKey: "k", model: "m", fetchImpl: f.impl }).completeJson(req)).toEqual({ b: 2 });
  });

  it("returns the raw text when the reply is not JSON, so the caller's validation can retry", async () => {
    const f = fakeFetch(textReply("sorry, no json"));
    expect(await createGeminiLlm({ apiKey: "k", model: "m", fetchImpl: f.impl }).completeJson(req)).toBe("sorry, no json");
  });

  it("throws LlmUnavailableError without leaking the key on provider errors and network failures", async () => {
    const f = fakeFetch({ error: { message: "bad key secret-key" } }, 403);
    const err = (await createGeminiLlm({ apiKey: "secret-key", model: "m", fetchImpl: f.impl }).completeJson(req).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect(err.message).not.toContain("secret-key");
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(createGeminiLlm({ apiKey: "k", model: "m", fetchImpl: boom }).completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it("maps a blocked prompt or a safety stop to OUT_OF_SCOPE", async () => {
    for (const reply of [{ promptFeedback: { blockReason: "SAFETY" } }, textReply("", "SAFETY")]) {
      const f = fakeFetch(reply);
      const out = (await createGeminiLlm({ apiKey: "k", model: "m", fetchImpl: f.impl }).completeJson(req)) as { error: { code: string } };
      expect(out.error.code).toBe("OUT_OF_SCOPE");
    }
  });
});
