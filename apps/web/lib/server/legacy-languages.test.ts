import { describe, expect, it } from "vitest";
import { LangSchema, PracticeSchema } from "@mourabbi/schemas";
import { getTemplates } from "../templates";

describe("practices saved while Arabic or German existed", () => {
  it("still parse: the leftover text of removed languages is dropped", () => {
    const [t] = getTemplates();
    const old = JSON.parse(JSON.stringify(t)) as {
      name: Record<string, string>;
      coachingPoints: Record<string, string[]>;
      animation: { steps: { caption: Record<string, string> }[] };
    };
    old.name.ar = "اسم";
    old.name.de = "Name";
    old.coachingPoints.ar = ["نقطة"];
    old.coachingPoints.de = ["Punkt"];
    old.animation.steps.forEach((s) => {
      s.caption.ar = "شرح";
      s.caption.de = "Schritt";
    });
    const r = PracticeSchema.safeParse(old);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data.name).sort()).toEqual(["en", "fr"]);
      expect(Object.keys(r.data.coachingPoints).sort()).toEqual(["en", "fr"]);
    }
  });

  it("an old language setting of ar or de reads as French", () => {
    expect(LangSchema.parse("ar")).toBe("fr");
    expect(LangSchema.parse("de")).toBe("fr");
    expect(LangSchema.parse("en")).toBe("en");
    expect(LangSchema.safeParse("xx").success).toBe(false);
  });

  it("every template has French and English text", () => {
    for (const t of getTemplates()) {
      expect(t.name.fr, t.id).not.toBe(t.name.en);
      expect(Object.keys(t.name).sort(), t.id).toEqual(["en", "fr"]);
    }
  });
});
