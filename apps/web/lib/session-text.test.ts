import { describe, expect, it } from "vitest";
import { runSessionChecks, type Practice, type SessionMeta } from "@mourabbi/schemas";
import { getTemplate, getTemplates, filterPractices, parseFilters } from "./templates";
import { buildShareText, describeChecks, whatsappUrl, type T } from "./session-text";
import { safeNext } from "./server/auth";
import { isOutOfScope } from "./server/scope";
import en from "../messages/en.json";

// A tiny ICU-ish translator over the English catalogue, enough to test message building.
function makeT(): T {
  const get = (key: string): string => {
    const v = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
    if (typeof v !== "string") throw new Error(`missing message ${key}`);
    return v;
  };
  return (key, values = {}) => get(key).replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

const meta = (o: Partial<SessionMeta> = {}): SessionMeta => ({
  ageGroup: "U12", playerCount: 12, availableMinutes: 90,
  space: { lengthM: 40, widthM: 30, surface: "grass" },
  equipment: ["balls", "cones", "bibs", "mini_goals", "full_goals"], language: "en", ...o,
});
const ids = ["dynamic_warmup_ball", "corner_goals_3v3_u12", "small_sided_game_5v5", "cooldown_walk_stretch"];
const practices = new Map<string, Practice>(ids.map((id) => [id, getTemplate(id)!]));
const phases = (mins = [12, 25, 30, 5]) => ids.map((id, i) => ({ order: i + 1, practiceId: id, kind: practices.get(id)!.kind, durationMinutes: mins[i]! }));

describe("share text", () => {
  const session = { meta: meta(), focus: { theme: "width_and_support" as const, sourceNote: "private note about Ahmed" }, phases: phases(), totalDurationMinutes: 72 };

  it("summarises title, phases with minutes and key coaching points, without the coach's note", () => {
    const text = buildShareText(session, practices, "en", makeT());
    expect(text).toContain("U12 session: Width and support");
    expect(text).toContain("1. Dynamic warm-up with a ball (12 min)");
    expect(text).toContain("2. Corner goals 3v3 (25 min)");
    expect(text).toContain("Create width early so the ball can switch sides");
    expect(text).not.toContain("Ahmed");
  });

  it("limits coaching points for young groups (one per practice under U10)", () => {
    const young = { ...session, meta: meta({ ageGroup: "U8" }) };
    const lines = buildShareText(young, practices, "en", makeT()).split("\n").filter((l) => l.startsWith("   - "));
    expect(lines).toHaveLength(4); // one per practice, 4 practices
  });

  it("builds a wa.me link with the text encoded", () => {
    const url = whatsappUrl("a b\nc&d");
    expect(url).toBe("https://wa.me/?text=a%20b%0Ac%26d");
  });
});

describe("describeChecks", () => {
  const run = (m = meta(), mins = [12, 25, 30, 5]) =>
    describeChecks(
      runSessionChecks({ meta: m, phases: phases(mins), totalDurationMinutes: mins.reduce((a, b) => a + b, 0) }, (id) => practices.get(id)),
      practices, "en", makeT(),
    );

  it("renders passes and the review warning in words", () => {
    const lines = run();
    expect(lines.find((l) => l.id === "time")!.details[0]).toBe("72 of 90 min");
    expect(lines.find((l) => l.id === "review")!.status).toBe("warning");
    expect(lines.find((l) => l.id === "review")!.details[0]).toBe("4 of 4 not reviewed yet");
  });

  it("names the drill that does not fit the players, space or equipment", () => {
    const l = run(meta({ playerCount: 30, space: { lengthM: 25, widthM: 20, surface: "grass" }, equipment: ["balls"] }));
    expect(l.find((x) => x.id === "players")!.details.join(" ")).toContain("Corner goals 3v3 needs 6 to 12");
    expect(l.find((x) => x.id === "space")!.details.join(" ")).toContain("needs 40 by 30 m");
    expect(l.find((x) => x.id === "equipment")!.details.join(" ")).toContain("Cones");
  });

  it("explains time over the limit", () => {
    const l = run(meta({ availableMinutes: 60 }));
    expect(l.find((x) => x.id === "time")!.details[0]).toBe("72 min is 12 over the 60 available");
  });
});

describe("template filters", () => {
  const all = getTemplates();
  it("filters by kind, age, players and area (rotation allowed)", () => {
    expect(filterPractices(all, { kind: "warmup" }).every((p) => p.kind === "warmup")).toBe(true);
    expect(filterPractices(all, { age: "U10" }).map((p) => p.id)).toContain("rondo_4v2_u10");
    expect(filterPractices(all, { age: "U10" }).map((p) => p.id)).not.toContain("buildout_4v2_u14");
    expect(filterPractices(all, { players: 30 }).map((p) => p.id)).toContain("dynamic_warmup_ball");
    expect(filterPractices(all, { players: 30 }).map((p) => p.id)).not.toContain("rondo_4v2_u10");
    expect(filterPractices(all, { lengthM: 20, widthM: 30 }).map((p) => p.id)).toContain("corner_goals_3v3_u12");
    expect(filterPractices(all, { lengthM: 20, widthM: 15 }).map((p) => p.id)).not.toContain("corner_goals_3v3_u12");
  });
  it("hides templates needing equipment you do not have", () => {
    const ids = filterPractices(all, { equipment: ["balls", "cones"] }).map((p) => p.id);
    expect(ids).toContain("rondo_4v2_u10");
    expect(ids).not.toContain("corner_goals_3v3_u12");
  });
  it("searches names in any language, ignoring accents", () => {
    expect(filterPractices(all, { q: "ECHAUFFEMENT" }).map((p) => p.id)).toContain("dynamic_warmup_ball");
    expect(filterPractices(all, { q: "روندو" }).map((p) => p.id)).toContain("rondo_4v2_u10");
  });
  it("parses search params defensively", () => {
    const f = parseFilters({ kind: "nope", age: "U10", players: "abc", equip: ["balls", "lasers"], l: "30", w: "-4" });
    expect(f).toMatchObject({ kind: undefined, age: "U10", players: undefined, equipment: ["balls"], lengthM: 30, widthM: undefined });
  });
});

describe("safeNext and scope", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNext("/plan/new")).toBe("/plan/new");
    expect(safeNext("//evil.com")).toBe("/plan/new");
    expect(safeNext("https://evil.com")).toBe("/plan/new");
    expect(safeNext("/\\evil.com")).toBe("/plan/new");
    expect(safeNext(null)).toBe("/plan/new");
  });
  it("flags health and diet requests but not coaching language", () => {
    expect(isOutOfScope("which medication for his knee")).toBe(true);
    expect(isOutOfScope("treatment for a sprained ankle")).toBe(true);
    expect(isOutOfScope("lose weight diet plan")).toBe(true);
    expect(isOutOfScope("نريد دواء للاعب")).toBe(true);
    expect(isOutOfScope("pressing after losing the ball, finishing in the box")).toBe(false);
    expect(isOutOfScope("قلة العرض والمساندة بعد التمريرة الأولى")).toBe(false);
    expect(isOutOfScope("Nous avons perdu la largeur après la première passe")).toBe(false);
  });
});
