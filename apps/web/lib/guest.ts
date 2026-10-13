import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Guest accounts: visitors who open a feature get an anonymous account automatically, so nobody
 * has to type an email before using the app. Signing in with an email stays available.
 */
export const GUEST_DOMAIN = "guest.local";
export const MOCK_COOKIE = "mock_user";

export function isGuestEmail(email: string): boolean {
  return email.endsWith(`@${GUEST_DOMAIN}`);
}

/** Mock-backend identity for a new guest (a valid-looking address that can never receive mail). */
export function newGuestEmail(): string {
  return `guest-${crypto.randomUUID()}@${GUEST_DOMAIN}`;
}

/** Pages that need an account. Public pages (shared links, privacy, offline, login) never create one. */
const FEATURE_PATHS = /^\/(?:plan|practice|library|templates\/[^/]+)(?:\/|$)/;

export function needsAccount(pathname: string, method: string): boolean {
  return method === "GET" && FEATURE_PATHS.test(pathname);
}

/**
 * MongoDB mode has no auth provider, so a visitor is a guest identified by a signed cookie:
 * `<uuid>.<hmac>`. The signature stops anyone from claiming another visitor's id.
 */
export const GUEST_COOKIE = "coach_guest";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

export function newGuestCookie(secret: string): { id: string; value: string } {
  const id = crypto.randomUUID();
  return { id, value: `${id}.${sign(id, secret)}` };
}

/** The guest id when the cookie is genuine, otherwise null. */
export function verifyGuestCookie(value: string | undefined, secret: string): string | null {
  if (!value || !secret) return null;
  const dot = value.indexOf(".");
  if (dot < 1) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id, secret));
  if (!/^[0-9a-f-]{36}$/.test(id) || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}
