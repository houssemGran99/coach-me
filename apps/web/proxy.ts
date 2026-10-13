import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "./i18n/config";
import {
  GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, MOCK_COOKIE, needsAccount, newGuestCookie, newGuestEmail, verifyGuestCookie,
} from "./lib/guest";

/**
 * 1. `?lang=fr|en|de` sets the language cookie and drops the parameter, so shared links can pick a language.
 * 2. Opening a feature page without an account creates an automatic guest account (no email needed).
 */
export async function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang && isLocale(lang)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  let response = NextResponse.next({ request });
  const wantsAccount = needsAccount(request.nextUrl.pathname, request.method);

  if (process.env.MOCK_BACKEND === "1") {
    if (wantsAccount && !request.cookies.get(MOCK_COOKIE)) {
      const value = Buffer.from(newGuestEmail(), "utf8").toString("base64url");
      request.cookies.set(MOCK_COOKIE, value);
      response = NextResponse.next({ request });
      response.cookies.set(MOCK_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return response;
  }
  if (process.env.MONGODB_URI) {
    const secret = process.env.AUTH_SECRET ?? "";
    if (wantsAccount && secret && !verifyGuestCookie(request.cookies.get(GUEST_COOKIE)?.value, secret)) {
      const { value } = newGuestCookie(secret);
      request.cookies.set(GUEST_COOKIE, value);
      response = NextResponse.next({ request });
      response.cookies.set(GUEST_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: GUEST_COOKIE_MAX_AGE });
    }
    return response;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
