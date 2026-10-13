import { AGE_GROUPS, areaFits, type AgeGroup, type Area, type Lang, type Practice, type Theme } from "@mourabbi/schemas";

/** What we understood from a coach's message. Anything not mentioned stays undefined (no constraint). */
export interface Constraints {
  age?: AgeGroup;
  players?: number;
  area?: Area;
  themes: Theme[];
}

const ARABIC = /[؀-ۿ]/g;
const FRENCH_HINT = /[àâçéèêëîïôùûœ]|\b(le|la|les|des|un|une|du|de|pour|avec|sans|sur|après|apres|et|ou|joueurs?|terrain|exercice|séance|seance|passes?|contre|ballon|moins|ans|petit|grand|demi|gardien|ptit|bch|barcha|3la|fi|el|mta3)\b/i;
const GERMAN_CHARS = /[äöüß]/i;
const GERMAN_HINT = /\b(der|die|das|und|mit|ohne|für|nach|gegen|spieler|übung|uebung|einheit|tor|torwart|torhüter|abschluss|ballbesitz|halbes|feld|kleines|großes|jahre|jährige)\b/i;
const ENGLISH_HINT = /\b(the|and|with|without|for|players?|pitch|drill|practice|after|half|small|goal|keeper|under|session|make|add)\b/i;

/**
 * The language of the coach's message decides the language of the reply.
 * Darija mixed with French (Latin script) counts as French; Arabic script counts as Arabic.
 */
export function detectLanguage(text: string, fallback: Lang): Lang {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return fallback;
  const arabic = (text.match(ARABIC) ?? []).length;
  if (arabic / letters.length > 0.3) return "ar";
  const de = GERMAN_CHARS.test(text) || GERMAN_HINT.test(text);
  if (de && !FRENCH_HINT.test(text.replace(GERMAN_CHARS, ""))) return "de";
  const fr = FRENCH_HINT.test(text);
  const en = ENGLISH_HINT.test(text);
  if (fr && !en) return "fr";
  if (en && !fr) return "en";
  if (fr && en) return /[àâçéèêëîïôùûœ]/i.test(text) ? "fr" : "en";
  // Latin script with no clear cue (darija transliteration, numbers): French is the common working language.
  return /[a-z]/i.test(text) ? "fr" : fallback;
}

const THEME_WORDS: [Theme, RegExp][] = [
  ["finishing", /finish|shoot|shot|cutback|cut-back|cross|goal ?scor|finition|tir(er|s)?\b|centre|frappe|abschluss|schie(ß|ss)en|flanke|إنهاء|تسديد|إنهاء الهجمات|ارتدادي/i],
  ["possession", /possession|keep.?ball|keep the ball|rondo|conservation|garder le ballon|ballbesitz|استحواذ|الاحتفاظ بالكرة/i],
  ["passing", /\bpass|passes?\b|passing|passspiel|تمرير/i],
  ["receiving", /receiv|first touch|control|réception|contrôle|ballannahme|استلام/i],
  ["width_and_support", /width|support|largeur|soutien|breite|unterstützung|عرض|مساندة/i],
  ["pressing", /press|pressing|ضغط/i],
  ["transition", /transition|counter|contre-attaque|après avoir perdu|après une perte|losing the ball|umschalten|konter|ballverlust|تحول|مرتدة/i],
  ["decision_making", /decision|décision|choix|entscheidung|قرار/i],
  ["dribbling", /dribbl|conduite de balle|مراوغ/i],
  ["1v1_attacking", /1\s?(v|vs|contre|ضد)\s?1.*(attack|attaque|هجوم)|(attack|attaque|هجوم).*1\s?(v|vs|contre)\s?1/i],
  ["1v1_defending", /1\s?(v|vs|contre|ضد)\s?1.*(defend|défense|دفاع)|(defend|défens|دفاع).*1\s?(v|vs|contre)\s?1/i],
  ["goalkeeping", /goalkeeper|keeper|gardien|torwart|torhüter|حارس/i],
];

const SIDES = /\b(\d{1,2})\s?(?:v|vs|contre|gegen|x|ضد)\s?(\d{1,2})\b/i;

/** Heuristic, language-tolerant extraction of the constraints a coach usually gives. */
export function parseConstraints(message: string): Constraints {
  const m = message.normalize("NFC");
  const c: Constraints = { themes: [] };

  const age =
    /\bU\s?(\d{1,2})\b/i.exec(m) ??
    /\b(?:under|moins de|<)\s?(\d{1,2})\b/i.exec(m) ??
    /(?:تحت|أقل من)\s?(\d{1,2})/.exec(m) ??
    /\b(\d{1,2})\s?(?:ans|years?|سنة|سنوات)\b/i.exec(m);
  if (age) {
    const g = `U${age[1]}` as AgeGroup;
    if ((AGE_GROUPS as readonly string[]).includes(g)) c.age = g;
  } else if (/\bseniors?\b|séniors?|الكبار/i.test(m)) c.age = "senior";

  const sides = SIDES.exec(m);
  const direct = /(\d{1,2})\s*(?:players?|joueu\w*|لاعب\w*|لاعبين)/i.exec(m);
  if (direct) c.players = Number(direct[1]);
  else if (sides) c.players = Number(sides[1]) + Number(sides[2]);

  const dims = /(\d{1,3})\s*(?:m\b|م\b)?\s*(?:x|×|by|sur|par|\*)\s*(\d{1,3})\s*(?:m\b|م\b)?/i.exec(m);
  if (dims) {
    const a = Number(dims[1]);
    const b = Number(dims[2]);
    c.area = { lengthM: Math.max(a, b), widthM: Math.min(a, b) };
  } else if (/half (a )?pitch|half-pitch|demi[- ]terrain|moitié de terrain|نصف ملعب/i.test(m)) c.area = { lengthM: 50, widthM: 68 };
  else if (/full pitch|whole pitch|terrain entier|tout le terrain|ملعب كامل/i.test(m)) c.area = { lengthM: 100, widthM: 65 };

  for (const [theme, re] of THEME_WORDS) if (re.test(m)) c.themes.push(theme);
  return c;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface Ranked {
  practice: Practice;
  score: number;
  fits: boolean;
}

/**
 * Rank templates for a request. `fits` means every stated hard constraint (age, players, space) is met
 * and the theme matches (or no theme was asked for and the words overlap).
 */
export function rankTemplates(templates: Practice[], c: Constraints, message: string): Ranked[] {
  const words = norm(message).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  return templates
    .map((p) => {
      const hard =
        (!c.age || p.ageGroups.includes(c.age)) &&
        (c.players === undefined || (c.players >= p.minPlayers && c.players <= p.maxPlayers)) &&
        (!c.area || areaFits(p.area, c.area));
      const themeHits = c.themes.filter((t) => p.themes.includes(t)).length;
      const hay = norm(`${p.id} ${p.name.en} ${p.name.fr} ${p.organisation.en}`);
      const wordHits = words.filter((w) => hay.includes(w)).length;
      const soft = (c.age && p.ageGroups.includes(c.age) ? 1 : 0) + (c.players !== undefined && c.players >= p.minPlayers && c.players <= p.maxPlayers ? 1 : 0);
      const score = themeHits * 3 + Math.min(wordHits, 3) + soft * 0.5;
      const themed = c.themes.length ? themeHits > 0 : wordHits > 0;
      return { practice: p, score, fits: hard && themed };
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits) || b.score - a.score || a.practice.id.localeCompare(b.practice.id));
}
