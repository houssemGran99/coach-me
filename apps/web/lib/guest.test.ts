import { describe, expect, it } from "vitest";
import { isGuestEmail, needsAccount, newGuestEmail } from "./guest";

describe("guest accounts", () => {
  it("creates distinct guest addresses that are recognised as guests", () => {
    const a = newGuestEmail();
    expect(a).not.toBe(newGuestEmail());
    expect(isGuestEmail(a)).toBe(true);
    expect(isGuestEmail("coach@example.com")).toBe(false);
  });

  it("only feature pages open an account, and only on GET", () => {
    for (const p of ["/plan/new", "/plan/abc", "/practice/new", "/library", "/library/abc", "/templates/rondo_4v2_u10"]) {
      expect(needsAccount(p, "GET")).toBe(true);
    }
    for (const p of ["/", "/login", "/p/abc", "/templates", "/offline", "/privacy", "/api/generate", "/onboarding"]) {
      expect(needsAccount(p, "GET")).toBe(false);
    }
    expect(needsAccount("/plan/new", "POST")).toBe(false);
  });
});
