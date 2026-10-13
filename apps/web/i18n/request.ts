import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiate, type Locale } from "./config";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  // German unless the visitor picked a language. The browser's language is only used when NEGOTIATE_LANGUAGE=1
  // (the end-to-end tests rely on it).
  const locale: Locale = isLocale(fromCookie)
    ? fromCookie
    : process.env.NEGOTIATE_LANGUAGE === "1"
      ? negotiate((await headers()).get("accept-language"))
      : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Africa/Tunis",
  };
});
