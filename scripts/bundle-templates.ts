import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXPECTED } from "./lib/expected";
import { REPO_ROOT, validateTemplates } from "./lib/templates";

export const PROMPTS_BUNDLE_PATH = path.join(REPO_ROOT, "apps/web/lib/generated/prompts.json");

/** Prompts live in /prompts as markdown; the web app imports this JSON instead of reading files at runtime. */
export function buildPromptsBundle(): string {
  const dir = path.join(REPO_ROOT, "prompts");
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
    out[f.replace(/\.system\.md$|\.md$/, "")] = readFileSync(path.join(dir, f), "utf8");
  }
  return JSON.stringify(out, null, 2) + "\n";
}

export const BUNDLE_PATH = path.join(REPO_ROOT, "apps/web/lib/generated/templates.json");

/** The single JSON the web app imports. Ordered as in the brief's table. */
export function buildBundle(): string {
  const { practices, problems } = validateTemplates({ partial: true });
  if (problems.length) {
    throw new Error("Templates are invalid:\n" + problems.map((p) => `  ${p.file}: ${p.message}`).join("\n"));
  }
  const order = new Map(EXPECTED.map((e) => [e.id, e.n]));
  practices.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return JSON.stringify(practices) + "\n";
}

if (process.argv[1] && /bundle-templates\.ts$/.test(process.argv[1].replaceAll("\\", "/"))) {
  mkdirSync(path.dirname(BUNDLE_PATH), { recursive: true });
  const out = buildBundle();
  writeFileSync(BUNDLE_PATH, out);
  writeFileSync(PROMPTS_BUNDLE_PATH, buildPromptsBundle());
  console.log(`Bundled ${JSON.parse(out).length} templates -> ${path.relative(REPO_ROOT, BUNDLE_PATH)}`);
}
