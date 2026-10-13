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
