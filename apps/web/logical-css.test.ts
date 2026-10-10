import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (/node_modules|\.next|generated/.test(p)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|css)$/.test(p) ? [p] : [];
  });
}

/** RTL works from day one only if no physical left/right utilities slip in. */
const BANNED: [RegExp, string][] = [
  [/(?<![\w-])-?(ml|mr|pl|pr)-(\d|\[|px|auto)/, "use ms-/me-/ps-/pe-"],
  [/(?<![\w-])(left|right)-(\d|\[|px|auto|full|1\/2)/, "use start-/end-"],
  [/(?<![\w-])text-(left|right)(?![\w-])/, "use text-start/text-end"],
  [/(?<![\w-])rounded-[lr]{1}(-|\b)/, "use rounded-s/rounded-e"],
  [/(?<![\w-])border-[lr](-|\s|")/, "use border-s/border-e"],
  [/(?<![\w-])float-(left|right)/, "use float-start/end"],
  [/\b(margin|padding)(Left|Right)\b/, "use logical inline styles"],
  [/\b(margin|padding)-(left|right)\s*:/, "use margin-inline-*"],
];

describe("logical properties only", () => {
  const files = walk(ROOT);
  it("scans source files", () => expect(files.length).toBeGreaterThan(10));
  for (const f of files) {
    it(path.relative(ROOT, f), () => {
      const src = readFileSync(f, "utf8");
      for (const [re, hint] of BANNED) {
        const m = re.exec(src);
        expect(m ? `${m[0]} (${hint})` : null).toBeNull();
      }
    });
  }
});

describe("no browser dialogs", () => {
  it("does not call alert, confirm or prompt", () => {
    for (const f of walk(ROOT)) {
      if (f.endsWith(".test.ts")) continue;
      const src = readFileSync(f, "utf8");
      expect(/(^|[^\w.])(alert|confirm|prompt)\(/.test(src), f).toBe(false);
    }
  });
});
