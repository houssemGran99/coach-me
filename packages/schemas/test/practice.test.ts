import { describe, expect, it } from "vitest";
import { PracticeSchema, isReviewed, trustLabel, z, type Practice } from "../src";
import { seed, seedPractices } from "./fixtures";

const parse = (p: unknown) => PracticeSchema.safeParse(p);

describe("PracticeSchema", () => {
  it("accepts every seed practice", () => {
    for (const p of seedPractices()) {
      const r = parse(p);
      expect(r.success, `${p.id}: ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });

  it("rejects unknown keys at every level", () => {
    expect(parse({ ...seed("rondo_4v2_u10"), extra: 1 }).success).toBe(false);
    const p = seed("rondo_4v2_u10") as unknown as { area: Record<string, unknown> };
    p.area.depth = 3;
    expect(parse(p).success).toBe(false);
    const q = seed("rondo_4v2_u10") as unknown as { animation: { steps: Record<string, unknown>[] } };
    q.animation.steps[0]!.speed = 2;
    expect(parse(q).success).toBe(false);
  });

  it("requires text in fr, en and ar", () => {
    const p = seed("rondo_4v2_u10") as unknown as { name: Record<string, string> };
    delete p.name.ar;
    expect(parse(p).success).toBe(false);
  });

  it("limits organisation to 600 chars and coaching points to 5 of 200 chars", () => {
    const a = seed("rondo_4v2_u10");
    a.organisation.en = "x".repeat(601);
    expect(parse(a).success).toBe(false);
    const b = seed("rondo_4v2_u10");
    b.coachingPoints.en = ["a", "b", "c", "d", "e", "f"];
    b.coachingPoints.fr = ["a", "b", "c", "d", "e", "f"];
    b.coachingPoints.ar = ["a", "b", "c", "d", "e", "f"];
    expect(parse(b).success).toBe(false);
    const c = seed("rondo_4v2_u10");
    c.coachingPoints.en = ["x".repeat(201)];
    c.coachingPoints.fr = ["x"];
    c.coachingPoints.ar = ["x"];
    expect(parse(c).success).toBe(false);
  });

  it("needs the same number of coaching points in every language", () => {
    const p = seed("rondo_4v2_u10");
    p.coachingPoints.en = ["one"];
    expect(parse(p).success).toBe(false);
  });

  it("allows at most 3 variants", () => {
    const p = seed("rondo_4v2_u10");
    const v = p.variants[0]!;
    p.variants = [v, v, v, v];
    expect(parse(p).success).toBe(false);
  });

  it("rejects minPlayers above maxPlayers", () => {
    const p: Practice = { ...seed("rondo_4v2_u10"), minPlayers: 12, maxPlayers: 8 };
    expect(parse(p).success).toBe(false);
  });

  it("rejects duplicate age groups", () => {
    const p = seed("rondo_4v2_u10");
    p.ageGroups = ["U10", "U10"];
    expect(parse(p).success).toBe(false);
  });

  it("rejects an unknown theme, kind or age group", () => {
    expect(parse({ ...seed("rondo_4v2_u10"), themes: ["dancing"] }).success).toBe(false);
    expect(parse({ ...seed("rondo_4v2_u10"), kind: "nap" }).success).toBe(false);
    expect(parse({ ...seed("rondo_4v2_u10"), ageGroups: ["U30"] }).success).toBe(false);
  });
});

describe("review guard", () => {
  it("cannot be reviewed without a name and a date", () => {
    const p = seed("rondo_4v2_u10");
    p.review = { status: "reviewed", reviewedBy: null, reviewedAt: null };
    expect(parse(p).success).toBe(false);
    p.review = { status: "reviewed", reviewedBy: "Coach A", reviewedAt: null };
    expect(parse(p).success).toBe(false);
    p.review = { status: "reviewed", reviewedBy: "Coach A", reviewedAt: "2026-01-15" };
    expect(parse(p).success).toBe(true);
  });

  it("carries no reviewer unless reviewed", () => {
    const p = seed("rondo_4v2_u10");
    p.review = { status: "pending", reviewedBy: "Coach A", reviewedAt: "2026-01-15" };
    expect(parse(p).success).toBe(false);
  });

  it("never lets AI content be reviewed", () => {
    const p = seed("rondo_4v2_u10");
    p.source = "ai";
    p.review = { status: "reviewed", reviewedBy: "Coach A", reviewedAt: "2026-01-15" };
    expect(parse(p).success).toBe(false);
  });

  it("derives the trust label", () => {
    const p = seed("rondo_4v2_u10");
    expect(trustLabel(p)).toBe("pending");
    expect(isReviewed(p)).toBe(false);
    p.source = "ai";
    p.review = { status: "ai_draft", reviewedBy: null, reviewedAt: null };
    expect(trustLabel(p)).toBe("ai_draft");
    p.review = { status: "edited_by_owner", reviewedBy: null, reviewedAt: null };
    expect(trustLabel(p)).toBe("edited_by_owner");
    p.source = "template";
    p.review = { status: "reviewed", reviewedBy: "Coach A", reviewedAt: "2026-01-15" };
    expect(trustLabel(p)).toBe("reviewed");
  });
});

describe("JSON Schema derivation", () => {
  it("derives a JSON Schema from the Zod schema for structured output", () => {
    const js = z.toJSONSchema(PracticeSchema) as { type: string; additionalProperties?: boolean; required?: string[] };
    expect(js.type).toBe("object");
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toContain("animation");
  });
});
