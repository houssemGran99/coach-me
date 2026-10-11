import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED } from "./lib/expected";
import { loadTemplateFiles, validateTemplates } from "./lib/templates";

describe("template library", () => {
  it("every template file validates (the full list of 34 once authored)", () => {
    const { problems } = validateTemplates({ partial: true });
    expect(problems.map((p) => `${p.file}: ${p.message}`)).toEqual([]);
  });

  it("has the complete set of 34 templates", () => {
    const { problems } = validateTemplates();
    expect(problems.filter((p) => p.message.startsWith("missing template")).map((p) => p.file)).toEqual([]);
  });

  it("never claims 'reviewed' without a named reviewer and a date", () => {
    for (const { file, raw } of loadTemplateFiles()) {
      const r = (raw as { review: { status: string; reviewedBy: string | null; reviewedAt: string | null } }).review;
      if (r.status === "reviewed") {
        expect(r.reviewedBy?.trim(), `${file} reviewedBy`).toBeTruthy();
        expect(r.reviewedAt, `${file} reviewedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(r.status, file).toBe("pending");
        expect(r.reviewedBy, file).toBeNull();
        expect(r.reviewedAt, file).toBeNull();
      }
    }
  });

  it("matches the brief's table for ids that exist", () => {
    const ids = new Set(EXPECTED.map((e) => e.id));
    for (const { raw } of loadTemplateFiles()) expect(ids.has((raw as { id: string }).id)).toBe(true);
  });
});

describe("generated bundles are up to date", () => {
  it("apps/web templates.json matches data/templates (run pnpm templates:bundle)", async () => {
    const { buildBundle, BUNDLE_PATH, buildPromptsBundle, PROMPTS_BUNDLE_PATH } = await import("./bundle-templates");
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(BUNDLE_PATH, "utf8")).toBe(buildBundle());
    expect(readFileSync(PROMPTS_BUNDLE_PATH, "utf8")).toBe(buildPromptsBundle());
  });
});

describe("validator catches bad templates", () => {
  const tmp = () => mkdtempSync(path.join(os.tmpdir(), "tpl-"));
  const seed = () => JSON.parse(readFileSync(path.join(process.cwd(), "data/templates/rondo_4v2_u10.json"), "utf8"));

  it("flags a fake 'reviewed' status", () => {
    const dir = tmp();
    const p = seed();
    p.review = { status: "reviewed", reviewedBy: null, reviewedAt: null };
    writeFileSync(path.join(dir, "rondo_4v2_u10.json"), JSON.stringify(p));
    const { problems } = validateTemplates({ dir, partial: true });
    expect(problems.some((x) => x.message.includes("reviewed"))).toBe(true);
  });

  it("flags duplicate ids, wrong file names and missing Arabic", () => {
    const dir = tmp();
    const p = seed();
    writeFileSync(path.join(dir, "rondo_4v2_u10.json"), JSON.stringify(p));
    writeFileSync(path.join(dir, "copy.json"), JSON.stringify(p));
    const q = seed();
    q.id = "tag_with_ball";
    q.name.ar = "Tag";
    writeFileSync(path.join(dir, "tag_with_ball.json"), JSON.stringify(q));
    const msgs = validateTemplates({ dir, partial: true }).problems.map((x) => x.message).join("\n");
    expect(msgs).toContain("duplicate id");
    expect(msgs).toContain("file name must be");
    expect(msgs).toContain("no Arabic text");
  });

  it("flags an animation that breaks the rules and ranges that drift from the brief", () => {
    const dir = tmp();
    const p = seed();
    p.animation.actors[0].x = 99;
    p.maxPlayers = 12;
    writeFileSync(path.join(dir, "rondo_4v2_u10.json"), JSON.stringify(p));
    const msgs = validateTemplates({ dir, partial: true }).problems.map((x) => x.message).join("\n");
    expect(msgs).toContain("OUT_OF_BOUNDS");
    expect(msgs).toContain("differ from the brief");
  });

  it("flags a missing template when not partial", () => {
    const dir = tmp();
    const msgs = validateTemplates({ dir }).problems.map((x) => x.message);
    expect(msgs.filter((m) => m.startsWith("missing template"))).toHaveLength(34);
  });
});
