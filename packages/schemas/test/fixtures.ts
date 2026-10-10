import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Practice } from "../src";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");

export function seedPractices(): Practice[] {
  return JSON.parse(readFileSync(path.join(repoRoot, "reference/seed-practices.json"), "utf8")) as Practice[];
}

export function seed(id: string): Practice {
  const p = seedPractices().find((x) => x.id === id);
  if (!p) throw new Error(`no seed ${id}`);
  return structuredClone(p);
}

export function lookupFrom(practices: Practice[]) {
  const m = new Map(practices.map((p) => [p.id, p]));
  return (id: string) => m.get(id);
}
