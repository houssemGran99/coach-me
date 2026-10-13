import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "./i18n/config";
import { MOCK_COOKIE, needsAccount, newGuestEmail } from "./lib/guest";

/**
 * 1. `?lang=fr|ar|en` sets the language cookie and drops the parameter, so shared links can pick a language.
 * 2. Refreshes the Supabase session cookies on every request when Supabase is configured.
 * 3. Opening a feature page without an account creates an automatic guest account (no email needed).
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && wantsAccount) {
    // Needs "Anonymous sign-ins" enabled in the Supabase project. If it is off, pages fall back to the login page.
    await supabase.auth.signInAnonymously().catch(() => undefined);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
