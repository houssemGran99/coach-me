/** French copy for the landing page. Kept apart from the components so it is easy to review and translate. */
export const STRIP = [
  { value: "30 s", label: "pour une séance complète" },
  { value: "U6 → U19", label: "toutes les catégories d'âge" },
  { value: "3 langues", label: "français, arabe (RTL), anglais" },
  { value: "0 donnée", label: "personnelle sur les joueurs" },
] as const;

export const STEPS = [
  { title: "Décrivez votre groupe", text: "Catégorie d'âge, nombre de joueurs, matériel, espace disponible et ce qu'il faut améliorer : en français, en arabe ou en darija." },
  { title: "Recevez une séance", text: "Coach assemble les exercices adaptés. Vous modifiez, remplacez ou supprimez ce que vous voulez." },
  { title: "Entraînez et partagez", text: "Utilisez-la hors connexion, gardez vos exercices favoris dans votre bibliothèque et partagez-les par lien." },
] as const;

export const FAQ = [
  { q: "Est-ce gratuit ?", a: "Oui pendant le lancement. Une offre pour les académies (bibliothèque partagée entre plusieurs entraîneurs) viendra plus tard ; l'usage individuel restera accessible." },
  { q: "L'IA remplace-t-elle l'entraîneur ?", a: "Non. Tout ce qui est généré est un brouillon que vous modifiez, enregistrez ou rejetez. C'est vous qui décidez." },
  { q: "Faut-il installer une application ?", a: "Non, Coach s'ouvre dans le navigateur de votre téléphone et peut être ajoutée à l'écran d'accueil." },
  { q: "Quelles catégories d'âge ?", a: "De U6 à U17, U19 et seniors." },
  { q: "Collectez-vous des données sur mes joueurs ?", a: "Non. Vous décrivez un groupe, pas des enfants identifiés." },
] as const;
