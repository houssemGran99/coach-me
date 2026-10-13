import type { Lang } from "@mourabbi/schemas";

export interface PlayerLabels {
  title: string;
  /** Contains {n} and {m}. */
  step: string;
  play: string;
  pause: string;
  replay: string;
  prev: string;
  next: string;
  speed: string;
  scrub: string;
  aiDraft: string;
  pending: string;
  edited: string;
}

export const PLAYER_LABELS: Record<Lang, PlayerLabels> = {
  en: {
    title: "Practice animation", step: "Step {n} of {m}", play: "Play", pause: "Pause", replay: "Replay",
    prev: "Previous step", next: "Next step", speed: "Speed", scrub: "Timeline",
    aiDraft: "AI draft, not reviewed", pending: "Pending coach review", edited: "Edited by owner",
  },
  fr: {
    title: "Animation de l'exercice", step: "Étape {n} sur {m}", play: "Lecture", pause: "Pause", replay: "Rejouer",
    prev: "Étape précédente", next: "Étape suivante", speed: "Vitesse", scrub: "Chronologie",
    aiDraft: "Brouillon IA, non vérifié", pending: "En attente de validation", edited: "Modifié par le propriétaire",
  },
  de: {
    title: "Übungsanimation", step: "Schritt {n} von {m}", play: "Abspielen", pause: "Pause", replay: "Nochmal",
    prev: "Vorheriger Schritt", next: "Nächster Schritt", speed: "Tempo", scrub: "Zeitleiste",
    aiDraft: "KI-Entwurf, nicht geprüft", pending: "Trainerprüfung ausstehend", edited: "Vom Besitzer bearbeitet",
  },
};

export const fill = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
