"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next, mock }: { next: string; mock: boolean }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  return (
    <form action={action} className="card grid max-w-md gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">{t("email")}</label>
        <input
          id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" dir="ltr"
          aria-describedby="email-msg" aria-invalid={state.status === "error"}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("sending") : t("sendLink")}
      </button>
      <div id="email-msg" role="status" aria-live="polite">
        {state.status === "sent" && <p className="banner">{t("sent")}</p>}
        {state.status === "error" && <p className="banner banner-bad">{t(state.error === "invalidEmail" ? "invalidEmail" : "failed")}</p>}
      </div>
      {mock && <p className="hint">{t("mockNote")}</p>}
    </form>
  );
}
