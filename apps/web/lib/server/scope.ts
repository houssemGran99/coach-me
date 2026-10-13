/**
 * Cheap, deterministic first line of defence. These coaches work with children, so we refuse
 * anything about a child's health, medication, diet or injury treatment before it reaches the model.
 * The model is also told to return OUT_OF_SCOPE; this check just does not depend on it.
 */
const PATTERNS: RegExp[] = [
  // English
  /\b(medic(ation|ine|ines)|pills?|dosage|prescri(be|ption)|diagnos(e|is)|antibiotics?|paracetamol|ibuprofen|steroids?|supplements?|surgery)\b/i,
  /\b(treat(ing|ment)?|heal(ing)?|cure|rehab(ilitation)?|recover(y)?) (for |of |from |my |his |her |the |a |an )*(injur\w*|sprain\w*|fracture\w*|strain\w*|concussion\w*|ligament\w*)/i,
  /\b(injur\w*|sprain\w*|fracture\w*|concussion\w*) (treatment|rehab\w*|recovery|cure)/i,
  /\b(diet|dieting|weight[- ]loss|lose weight|calorie\w*|meal plan)\b/i,
  // French
  /(médicament|ordonnance|posologie|diagnostic|antibiotique|paracétamol|ibuprofène|stéroïde|complément(s)? alimentaire|chirurgie|dopage)/i,
  /(soigner|traiter|traitement|guérir|rééducation|récupérer de)\s+(de |d'|du |la |le |l'|une |un |sa |son )*(blessure|entorse|fracture|déchirure|commotion|ligament|claquage)/i,
  /(régime( alimentaire)?|perdre du poids|perte de poids|calories)/i,
  // German
  /\b(medikament\w*|tablette\w*|dosierung|rezept|diagnose|antibiotik\w*|paracetamol|ibuprofen|steroid\w*|nahrungsergänzung\w*|operation|doping)\b/i,
  /\b(verletzung\w*|zerrung\w*|bänderriss\w*|bruch|gehirnerschütterung\w*)\b.{0,30}\b(behandl\w*|heilen|heilung|reha\w*|therapie)|\b(behandl\w*|heilen|reha\w*|therapie)\b.{0,30}\b(verletzung\w*|zerrung\w*|bänderriss\w*|gehirnerschütterung\w*)/i,
  /\b(diät|abnehmen|gewichtsverlust|kalorien\w*|ernährungsplan)\b/i,
  // Arabic (and darija written in Arabic script)
  /(دواء|دوا\b|أدوية|وصفة طبية|جرعة|مضاد حيوي|باراسيتامول|تشخيص|جراحة|عملية جراحية|منشطات|مكملات|مكمّلات)/,
  /(علاج|معالجة|تأهيل|شفاء)\s+(من\s+|ال)?(إصابة|اصابة|الإصابة|الاصابة|كسر|الكسر|التواء|الالتواء|ارتجاج|تمزق|الرباط)/,
  /(حمية|رجيم|تخسيس|إنقاص الوزن|السعرات)/,
];

export function isOutOfScope(text: string): boolean {
  const t = text.normalize("NFC");
  return PATTERNS.some((re) => re.test(t));
}

/** Escape text so it cannot close or open the delimited blocks of a prompt. */
export function escapeForPrompt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
