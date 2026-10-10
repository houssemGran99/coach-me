"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgeGroupSchema, LangSchema } from "@mourabbi/schemas";
import { LOCALE_COOKIE } from "@/i18n/config";
import { getUser, safeNext } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";

export async function saveOnboarding(form: FormData): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");
  const language = LangSchema.catch("fr").parse(String(form.get("language") ?? "fr"));
  const age = AgeGroupSchema.safeParse(String(form.get("age") ?? ""));
  const store = await getStore();
  await store.upsertProfile({ id: user.id, language, default_age_group: age.success ? age.data : null });
  (await cookies()).set(LOCALE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(safeNext(String(form.get("next") ?? "")));
}
