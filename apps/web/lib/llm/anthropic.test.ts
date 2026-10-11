import { describe, expect, it } from "vitest";
import { createAnthropicLlm } from "./anthropic";
import { LlmUnavailableError, extractJson } from "./types";

function fakeFetch(reply: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const textReply = (t: string) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn" });
const req = { task: "session" as const, system: "SYS", user: "USER" };

describe("createAnthropicLlm", () => {
  it("sends the key only as a header and the prompt as system/user", async () => {
    const f = fakeFetch(textReply('{"a":1}'));
    const out = await createAnthropicLlm({ apiKey: "sk-secret", model: "claude-haiku-4-5", fetchImpl: f.impl }).completeJson(req);
    expect(out).toEqual({ a: 1 });
    const { url, init } = f.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-secret");
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe("SYS");
    expect(body.messages).toEqual([{ role: "user", content: "USER" }]);
    expect(JSON.stringify(body)).not.toContain("sk-secret");
  });

  it("uses temperature <= 0.3 on older models and no sampling parameters on the Claude 5 family", async () => {
    const old = fakeFetch(textReply("{}"));
    await createAnthropicLlm({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: old.impl }).completeJson(req);
    const oldBody = JSON.parse(old.calls[0]!.init.body as string);
    expect(oldBody.temperature).toBeLessThanOrEqual(0.3);
    expect(oldBody.output_config).toBeUndefined();

    for (const model of ["claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-1"]) {
      const f = fakeFetch(textReply("{}"));
      await createAnthropicLlm({ apiKey: "k", model, fetchImpl: f.impl }).completeJson(req);
      const b = JSON.parse(f.calls[0]!.init.body as string);
      expect(b.temperature, model).toBeUndefined();
      expect(b.tool_choice, model).toBeUndefined();
    }
  });

  it("throws LlmUnavailableError without leaking the key on provider errors and network failures", async () => {
    const f = fakeFetch({ error: { message: "bad key sk-secret" } }, 401);
    const err = (await createAnthropicLlm({ apiKey: "sk-secret", model: "m", fetchImpl: f.impl }).completeJson(req).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect(String(err.message)).not.toContain("sk-secret");
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(createAnthropicLlm({ apiKey: "k", model: "m", fetchImpl: boom }).completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it("maps a model refusal to OUT_OF_SCOPE", async () => {
    const f = fakeFetch({ content: [], stop_reason: "refusal" });
    const out = (await createAnthropicLlm({ apiKey: "k", model: "m", fetchImpl: f.impl }).completeJson(req)) as { error: { code: string } };
    expect(out.error.code).toBe("OUT_OF_SCOPE");
  });
});

describe("extractJson", () => {
  it("parses plain, fenced and prose-wrapped JSON, and returns text otherwise", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":1} hope it helps')).toEqual({ a: 1 });
    expect(extractJson("not json")).toBe("not json");
  });
});
