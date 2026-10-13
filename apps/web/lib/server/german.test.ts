import { describe, expect, it } from "vitest";
import { PracticeSchema } from "@mourabbi/schemas";
import { detectLanguage } from "../practice-search";
import { getTemplates } from "../templates";
import { isOutOfScope } from "./scope";

describe("German", () => {
  it("detects German requests", () => {
    expect(detectLanguage("U12, 12 Spieler, Abschluss nach einem Rückpass, halbes Feld", "fr")).toBe("de");
    expect(detectLanguage("Übung für Ballbesitz mit vier Spielern", "en")).toBe("de");
    expect(detectLanguage("U12, 12 players, finishing after a cutback", "fr")).toBe("en");
    expect(detectLanguage("U12, 12 joueurs, finition après un centre en retrait", "en")).toBe("fr");
  });

  it("refuses health and diet questions", () => {
    expect(isOutOfScope("Welches Medikament und welche Diät für mein Kind?")).toBe(true);
    expect(isOutOfScope("Wie behandle ich die Verletzung eines Spielers?")).toBe(true);
    expect(isOutOfScope("U12, 12 Spieler, Abschluss nach einem Rückpass")).toBe(false);
  });

  it("every template has its own German text", () => {
    for (const t of getTemplates()) {
      expect(t.name.de, t.id).not.toBe(t.name.en);
      expect(t.animation.steps.every((s) => s.caption.de.length > 0 && s.caption.de !== s.caption.en), t.id).toBe(true);
    }
  });

  it("a practice saved before German existed stays valid and reads as English", () => {
    const [t] = getTemplates();
    const old = JSON.parse(JSON.stringify(t)) as { name: Record<string, string>; coachingPoints: Record<string, string[]> };
    delete old.name.de;
    delete old.coachingPoints.de;
    const r = PracticeSchema.safeParse(old);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name.de).toBe(t!.name.en);
      expect(r.data.coachingPoints.de).toEqual(t!.coachingPoints.en);
    }
  });
});
