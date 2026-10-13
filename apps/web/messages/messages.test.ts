import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";
import fr from "./fr.json";

type Tree = { [k: string]: string | string[] | Tree };

function flatten(t: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (Array.isArray(v)) v.forEach((s, i) => (out[`${key}[${i}]`] = s));
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const E = flatten(en as Tree);

describe("message catalogues", () => {
  for (const [name, cat] of [["fr", fr], ["ar", ar], ["de", de]] as const) {
    const C = flatten(cat as Tree);
    it(`${name} has exactly the keys of en`, () => {
      expect(Object.keys(C).sort()).toEqual(Object.keys(E).sort());
    });
    it(`${name} uses the same placeholders as en in every message`, () => {
      for (const k of Object.keys(E)) expect(vars(C[k] ?? ""), k).toBe(vars(E[k]!));
    });
    it(`${name} has no empty strings`, () => {
      for (const [k, v] of Object.entries(C)) expect(v.trim().length, k).toBeGreaterThan(0);
    });
  }

  it("ar messages are written in Arabic script (except proper names and numbers)", () => {
    const A = flatten(ar as Tree);
    const latinOnly = Object.entries(A).filter(([k, v]) => !/[؀-ۿ]/.test(v) && !/(^|\.)(brand)$/.test(k) && /[A-Za-z]{4,}/.test(v));
    expect(latinOnly.map(([k]) => k)).toEqual([]);
  });
});
