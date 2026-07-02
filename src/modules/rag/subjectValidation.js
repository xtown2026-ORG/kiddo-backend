const SUBJECTS = Object.freeze({
  maths: "Maths",
  math: "Maths",
  mathematics: "Maths",
  physics: "Physics",
  chemistry: "Chemistry",
  accounts: "Accounts",
  accountancy: "Accounts",
  commerce: "Commerce",
});

const SUBJECT_PATTERNS = Object.freeze({
  Maths: [
    /\b(?:maths?|mathematics|algebra|geometry|trigonometry|calculus|arithmetic|quadratic|polynomial|factor(?:ise|ize|isation|ization)?|probability|permutation|combination|fraction|percentage|ratio|mean|median|mode|perimeter|area|volume|hypotenuse|integer|prime|matrix|determinant|logarithm|number\s+system|place\s+value|face\s+value|expanded\s+form|successor|predecessor|multiple)\b/i,
    /(?:^|\s)(?:solve|find\s+the\s+roots?|simplify|evaluate|differentiate|integrate)\b[^\n]*(?:[=<>]|\b(?:sin|cos|tan)\b)/i,
    /\b[xyz]\s*(?:\^|[\u00b2\u00b3]|\*\*)?\s*\d*\s*[+\-=<>]/i,
    /\d\s*[+\-*/\u00d7\u00f7]\s*\d/,
    /(?:\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b[^\n]*\d|\d[^\n]*\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b)/i,
    /\b(?:compare|arrange|order)\b[^\n]*\d/i,
  ],
  Physics: [
    /\b(?:physics|kinematics|dynamics|velocity|acceleration|momentum|inertia|force|newton(?:'s)?\s+law|kinetic\s+energy|potential\s+energy|work\s+done|power|gravity|gravitational|friction|pressure|density|displacement|distance|speed|time|current|voltage|resistance|ohm(?:'s)?\s+law|electric(?:ity|al)?|magnetism|magnetic|wavelength|frequency|refraction|reflection|lens|mirror|optics|thermodynamics|heat|temperature)\b/i,
    /\b(?:kg|newtons?|joules?|watts?|volts?|amperes?|ohms?|hertz|metres?\s+per\s+second|m\/s|m\/s[\u00b2^2]*)\b/i,
  ],
  Chemistry: [
    /\b(?:chemistry|chemical|atom|atomic|molecule|molecular|element|compound|periodic\s+table|valency|mole|molarity|molality|solute|solvent|solution|concentration|acid|base|alkali|salt|ph|oxidation|reduction|redox|covalent|ionic|bond|isotope|electron\s+configuration|stoichiometry|titration|electrolysis|catalyst|hydrocarbon|organic\s+chemistry)\b/i,
    /\b(?:balance|complete)\b[^\n]*[A-Z][a-z]?\d*(?:\s*\+\s*[A-Z][a-z]?\d*)+/i,
    /(?:[A-Z][a-z]?\d*){2,}\s*(?:\+|->|\u2192|=)\s*(?:[A-Z][a-z]?\d*)+/,
  ],
  Accounts: [
    /\b(?:accounts?|accountancy|accounting|journal(?:ise|ize|isation|ization)?|journal\s+entr(?:y|ies)|ledger|debit|credit|trial\s+balance|balance\s+sheet|cash\s+book|bank\s+reconciliation|assets?|liabilit(?:y|ies)|capital\s+account|revenue|expenses?|depreciation|goodwill|profit\s+and\s+loss|trading\s+account|final\s+accounts?|bills?\s+(?:receivable|payable))\b/i,
  ],
  Commerce: [
    /\b(?:commerce|business\s+studies|business\s+environment|business\s+organisation|entrepreneurship|economics|demand|supply|market|trade|consumer|producer|partnership|company|shares?|debentures?|stock\s+exchange|wholesale|retail|e-?commerce|management|marketing|finance|human\s+resources?|business\s+law|gst)\b/i,
  ],
  English: [
    /\b(?:grammar|noun|pronoun|verb|adjective|adverb|preposition|conjunction|article|tense|sentence|synonym|antonym|homophone|active\s+voice|passive\s+voice|direct\s+speech|indirect\s+speech|reported\s+speech|poem|poetry|prose|novel|essay|letter\s+writing|comprehension)\b/i,
  ],
  "Social Science": [
    /\b(?:social\s+science|social\s+studies|history|geography|civics|political\s+science|constitution|democracy|parliament|government|citizen|fundamental\s+rights?|election|revolution|civilisation|civilization|empire|colonial|independence|latitude|longitude|continent|ocean|climate|natural\s+resources?)\b/i,
  ],
});

export const normalizeSelectedSubject = (subject) =>
  SUBJECTS[String(subject || "").trim().toLowerCase()] || null;

export const resolveQuestionSubject = ({ question, selectedSubject, subject }) => {
  const buttonSubject = normalizeSelectedSubject(selectedSubject ?? subject);

  if (buttonSubject) {
    return { subject: buttonSubject, source: "selected" };
  }

  return { subject: detectQuestionSubject(question), source: "detected" };
};

export const detectQuestionSubject = (question) => {
  const text = String(question || "").trim();
  if (!text) return null;

  const scores = Object.fromEntries(
    Object.entries(SUBJECT_PATTERNS).map(([subject, patterns]) => [
      subject,
      patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0),
    ])
  );

  // Domain language takes precedence over generic maths operators that commonly
  // occur in scientific, accounting, and commerce calculations.
  if (scores.English > 0) return "English";
  if (scores["Social Science"] > 0) return "Social Science";
  if (scores.Accounts > 0) return "Accounts";
  if (scores.Commerce > 0) return "Commerce";
  if (scores.Chemistry > 0) return "Chemistry";
  if (scores.Physics > 0) return "Physics";
  if (scores.Maths > 0) return "Maths";
  return null;
};

export const validateQuestionSubject = ({ question, selectedSubject, subject }) => {
  const normalizedSelectedSubject = normalizeSelectedSubject(selectedSubject ?? subject);
  const detectedSubject = detectQuestionSubject(question);
  const shouldReject = Boolean(
    normalizedSelectedSubject && normalizedSelectedSubject !== detectedSubject
  );

  return {
    isMatch: !shouldReject,
    shouldReject,
    selectedSubject: normalizedSelectedSubject,
    detectedSubject,
  };
};

export const SUBJECT_MISMATCH_RESPONSE = Object.freeze({
  success: false,
  type: "SUBJECT_MISMATCH",
  message:
    "The selected subject does not match your question. Please choose the correct subject and try again.",
});
