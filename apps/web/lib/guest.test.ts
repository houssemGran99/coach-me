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

import { newGuestCookie, verifyGuestCookie } from "./guest";

describe("signed guest cookie (MongoDB mode)", () => {
  const secret = "test-secret-with-enough-length";

  it("accepts its own cookie and returns the id", () => {
    const { id, value } = newGuestCookie(secret);
    expect(verifyGuestCookie(value, secret)).toBe(id);
  });

  it("rejects a changed id, a changed signature, another secret and garbage", () => {
    const a = newGuestCookie(secret);
    const b = newGuestCookie(secret);
    const sigA = a.value.slice(a.value.indexOf(".") + 1);
    expect(verifyGuestCookie(`${b.id}.${sigA}`, secret)).toBeNull();
    expect(verifyGuestCookie(`${a.id}.${sigA.slice(1)}x`, secret)).toBeNull();
    expect(verifyGuestCookie(a.value, "another-secret")).toBeNull();
    expect(verifyGuestCookie(a.value, "")).toBeNull();
    expect(verifyGuestCookie("not-a-cookie", secret)).toBeNull();
    expect(verifyGuestCookie(undefined, secret)).toBeNull();
    expect(verifyGuestCookie(`../../etc.${sigA}`, secret)).toBeNull();
  });
});
