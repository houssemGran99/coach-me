"use client";

import { useState, type FormEvent } from "react";

const ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ?? "";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) return setMsg("Veuillez saisir une adresse e-mail valide.");
    // Nothing is sent until NEXT_PUBLIC_WAITLIST_ENDPOINT points at a real endpoint.
    if (!ENDPOINT) return setMsg("Inscriptions bientôt ouvertes. Réessayez dans quelques jours.");
    setBusy(true);
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
      if (!r.ok) throw new Error(String(r.status));
      setMsg("Merci ! Nous vous écrivons très vite.");
      setEmail("");
    } catch {
      setMsg("Une erreur est survenue. Réessayez plus tard.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} noValidate>
        <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" aria-label="Adresse e-mail" required autoComplete="email" />
        <button className="btn gold" type="submit" disabled={busy}>Je veux essayer</button>
      </form>
      <div className="msg" role="status">{msg}</div>
    </>
  );
}
