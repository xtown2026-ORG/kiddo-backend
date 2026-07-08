const SUBJECTS = Object.freeze({
  maths: "Maths",
  math: "Maths",
  mathematics: "Maths",
  physics: "Physics",
  chemistry: "Chemistry",
  other: "Other Subjects",
  others: "Other Subjects",
  other_subjects: "Other Subjects",
  accounts: "Accounts",
  accountancy: "Accounts",
  commerce: "Commerce",
});

const REQUEST_SUBJECTS = new Set(["Maths", "Physics", "Chemistry", "Other Subjects"]);
const PRIMARY_VALIDATION_SUBJECTS = new Set(["Maths", "Physics", "Chemistry"]);
const SUBJECT_TIE_BREAK_ORDER = [
  "English",
  "Social Science",
  "Biology",
  "Accounts",
  "Commerce",
  "Chemistry",
  "Physics",
  "Maths",
];

const SUBJECT_PATTERNS = Object.freeze({
  Maths: [
    /\b(?:maths?|mathematics|algebra|geometry|trigonometry|calculus|arithmetic|quadratic|polynomial|factor(?:ise|ize|isation|ization)?|probability|permutation|combination|fraction|decimal|percentage|percent|ratio|proportion|average|mean|median|mode|perimeter|area|volume|circumference|diameter|radius|hypotenuse|integer|prime|composite|natural\s+number|whole\s+number|rational\s+number|irrational\s+number|odd\s+number|even\s+number|roman\s+numerals?|matrix|determinant|logarithm|number\s+system|place\s+value|face\s+value|expanded\s+form|standard\s+form|successor|predecessor|multiple|hcf|lcm|gcd|square\s+root|cube\s+root|square|cube|coordinate\s+geometry|linear\s+equation|simultaneous\s+equations?|inequalit(?:y|ies)|mensuration|statistics|histogram|bar\s+graph|pie\s+chart|arithmetic\s+progression|geometric\s+progression|sequence|series|limits?|derivatives?|differentiation|integrals?|integration|vectors?|sets?|venn\s+diagram)\b/i,
    /(?:^|\s)(?:solve|find\s+the\s+roots?|simplify|evaluate|differentiate|integrate)\b[^\n]*(?:[=<>]|\b(?:sin|cos|tan)\b)/i,
    /\b[xyz]\s*(?:\^|[\u00b2\u00b3]|\*\*)?\s*\d*\s*[+\-=<>]/i,
    /\d\s*(?:[+\-*/\u00d7\u00f7]|x)\s*\d/i,
    /(?:\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b[^\n]*\d|\d[^\n]*\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b)/i,
    /\b(?:compare|arrange|order)\b[^\n]*\d/i,
    /\b(?:sum|difference|product|quotient|total|altogether|remaining|left|more\s+than|less\s+than|each|equal\s+parts?|share|cost|price|amount)\b[^\n]*\d|\d[^\n]*\b(?:sum|difference|product|quotient|total|altogether|remaining|left|more\s+than|less\s+than|each|equal\s+parts?|share|cost|price|amount)\b/i,
    /\b(?:formula|find|calculate)\b[^\n]*\b(?:area|perimeter|volume|circumference|radius|diameter|simple\s+interest|compound\s+interest|profit|loss|discount)\b/i,
    /\b(?:how\s+many\s+(?:ways|arrangements?)|number\s+of\s+(?:ways|arrangements?)|can\s+be\s+(?:arranged|formed)|without\s+repetition|with\s+repetition|factorial|n\s*[pc]\s*r)\b/i,
    /\b(?:\d+\s*-?\s*digit\s+numbers?|digits?|possible\s+numbers?|using\s+the\s+digits?|numbers?\s+(?:can|could)\s+(?:be\s+)?(?:formed|written|made)|write\s+(?:all\s+)?(?:the\s+)?possible\s+numbers?)\b/i,
  ],
  Physics: [
    /\b(?:physics|kinematics|dynamics|velocity|acceleration|momentum|inertia|force|newton(?:'s)?\s+law|kinetic\s+energy|potential\s+energy|work\s+done|power|gravity|gravitational|friction|pressure|density|displacement|distance|speed|time|current|voltage|resistance|ohm(?:'s)?\s+law|electric(?:ity|al)?|magnetism|magnetic|wavelength|frequency|refraction|reflection|lens|mirror|optics|thermodynamics|heat|temperature|gas\s+law|boyle'?s\s+law|charles'?s\s+law|ideal\s+gas|constant\s+pressure|constant\s+temperature|scalar|vector|projectile|circular\s+motion|torque|equilibrium|fluid\s+mechanics|buoyancy|specific\s+heat|latent\s+heat|calorimetry|wave|sound|light|ray\s+diagram|electromagnetic|photoelectric|semiconductor|nuclear\s+physics|radioactivity)\b/i,
    /\b(?:kg|newtons?|joules?|watts?|volts?|amperes?|ohms?|hertz|tesla|weber|pascal|coulomb|metres?\s+per\s+second|m\/s|m\/s[\u00b2^2]*|n\/c|v\/m)\b/i,
  ],
  Chemistry: [
    /\b(?:chemistry|chemical|atoms?|atomic|molecules?|molecular|elements?|compounds?|periodic\s+table|valency|mole|molarity|molality|density|gas\s+law|boyle'?s\s+law|charles'?s\s+law|ideal\s+gas|states?\s+of\s+matter|solute|solvent|solution|concentration|acids?(?:\s+and\s+bases?)?|bases?\s+and\s+acids?|chemical\s+bases?|alkali|salt|ph|oxidation|reduction|redox|covalent|ionic|bond|isotope|electron\s+configuration|stoichiometry|titration|electrolysis|catalyst|hydrocarbon|organic\s+chemistry|inorganic\s+chemistry|physical\s+chemistry|metals?|non-?metals?|alloys?|reactants?|products?|chemical\s+reaction|chemical\s+equation|combustion|neutralisation|neutralization|crystallisation|crystallization|chromatography|polymer|functional\s+group|alkanes?|alkenes?|alkynes?|alcohols?|carboxylic\s+acids?|ester|benzene|enthalpy|equilibrium|ionic\s+product|solubility\s+product)\b/i,
    /\b(?:mass|volume|density)\b[^\n]*(?:\d\s*)?(?:g|grams?|cm(?:3|\^3|\u00b3)|ml|litres?|liters?)\b|(?:\d\s*)?(?:g|grams?|cm(?:3|\^3|\u00b3)|ml|litres?|liters?)\b[^\n]*\b(?:mass|volume|density)\b/i,
    /\b(?:balance|complete)\b[^\n]*[A-Z][a-z]?\d*(?:\s*\+\s*[A-Z][a-z]?\d*)+/i,
    /(?:[A-Z][a-z]?\d*){2,}\s*(?:\+|->|\u2192|=)\s*(?:[A-Z][a-z]?\d*)+/,
  ],
  Biology: [
    /\b(?:biology|biological|photosynthesis|respiration|chlorophyll|stomata|plant\s+cell|animal\s+cell|cell|tissue|organism|nutrition|digestion|excretion|reproduction|ecosystem|habitat|adaptation|microorganisms?|bacteria|virus|fungi|algae|roots?|stems?|leaves|leaf|flower|seed|pollination|germination)\b/i,
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

const EXPLICIT_MATHS_PATTERN =
  /\b(?:maths?|mathematics|algebra|geometry|trigonometry|calculus|arithmetic|quadratic|polynomial|probability|permutation|combination|statistics|mensuration|coordinate\s+geometry|linear\s+equation|simultaneous\s+equations?|inequalit(?:y|ies)|histogram|bar\s+graph|pie\s+chart|arithmetic\s+progression|geometric\s+progression|derivatives?|differentiation|integrals?|integration|sets?|venn\s+diagram)\b/i;
const GAS_LAW_OVERLAP_PATTERN =
  /\b(?:gas|gases|boyle'?s\s+law|charles'?s\s+law|ideal\s+gas|gas\s+law|constant\s+pressure|constant\s+temperature)\b/i;
const GAS_LAW_QUANTITY_PATTERN =
  /\b(?:volume|pressure|temperature|kelvin|celsius|°\s*c|litres?|liters?|\bl\b)\b/i;
const NUMERIC_MATHS_STRUCTURE_PATTERN =
  /\b(?:\d+\s*-?\s*digit\s+numbers?|digits?|possible\s+numbers?|using\s+the\s+digits?|numbers?\s+(?:can|could)\s+(?:be\s+)?(?:formed|written|made)|write\s+(?:all\s+)?(?:the\s+)?possible\s+numbers?)\b/i;

const getSubjectScores = (question) => {
  const text = String(question || "").trim();
  if (!text) return {};

  return Object.fromEntries(
    Object.entries(SUBJECT_PATTERNS).map(([subject, patterns]) => [
      subject,
      patterns.reduce((score, pattern) => {
        const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
        const globalPattern = new RegExp(pattern.source, flags);
        const matches = text.match(globalPattern) || [];
        return score + Math.min(matches.length, 4);
      }, 0),
    ])
  );
};

const getProvidedSubject = (...subjects) =>
  subjects.find((subject) => String(subject || "").trim()) || null;

export const normalizeSelectedSubject = (subject) => {
  const subjectKey = String(subject || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return SUBJECTS[subjectKey] || null;
};

export const normalizeRequestSubject = (subject) => {
  const normalizedSubject = normalizeSelectedSubject(subject);
  return REQUEST_SUBJECTS.has(normalizedSubject) ? normalizedSubject : null;
};

export const resolveQuestionSubject = ({ question, selectedSubject, subject }) => {
  const buttonSubject = normalizeSelectedSubject(getProvidedSubject(selectedSubject, subject));

  if (buttonSubject) {
    return { subject: buttonSubject, source: "selected" };
  }

  return { subject: detectQuestionSubject(question), source: "detected" };
};

export const detectQuestionSubject = (question) => {
  const scores = getSubjectScores(question);
  const text = String(question || "");

  if (GAS_LAW_OVERLAP_PATTERN.test(text) && GAS_LAW_QUANTITY_PATTERN.test(text)) {
    return scores.Chemistry >= scores.Physics ? "Chemistry" : "Physics";
  }

  let bestSubject = null;
  let bestScore = 0;

  for (const subject of SUBJECT_TIE_BREAK_ORDER) {
    const score = scores[subject] || 0;
    if (score > bestScore) {
      bestSubject = subject;
      bestScore = score;
    }
  }

  return bestSubject;
};

const getQuestionSubjectCandidates = (question) => {
  const scores = getSubjectScores(question);
  const text = String(question || "");
  const candidates = new Set();

  for (const subject of SUBJECT_TIE_BREAK_ORDER) {
    if (subject !== "Maths" && (scores[subject] || 0) > 0) {
      candidates.add(subject);
    }
  }

  if (GAS_LAW_OVERLAP_PATTERN.test(text) && GAS_LAW_QUANTITY_PATTERN.test(text)) {
    candidates.add("Physics");
    candidates.add("Chemistry");
  }

  if (
    (scores.Maths || 0) > 0 &&
    (!candidates.size || EXPLICIT_MATHS_PATTERN.test(text) || NUMERIC_MATHS_STRUCTURE_PATTERN.test(text))
  ) {
    candidates.add("Maths");
  }

  return candidates;
};

export const validateQuestionSubject = ({ question, selectedSubject, subject }) => {
  const normalizedSelectedSubject = normalizeSelectedSubject(getProvidedSubject(selectedSubject, subject));
  const detectedSubject = detectQuestionSubject(question);
  const shouldSkipSubjectValidation = normalizedSelectedSubject === "Other Subjects";
  const subjectCandidates = getQuestionSubjectCandidates(question);
  const selectedSubjectMatchesCandidates =
    subjectCandidates.size > 0 && subjectCandidates.has(normalizedSelectedSubject);
  const shouldReject = Boolean(
    !shouldSkipSubjectValidation &&
      PRIMARY_VALIDATION_SUBJECTS.has(normalizedSelectedSubject) &&
      subjectCandidates.size > 0 &&
      !selectedSubjectMatchesCandidates
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
  message: "The selected subject does not match the question.",
});

export const SUBJECT_REQUIRED_RESPONSE = Object.freeze({
  success: false,
  type: "SUBJECT_REQUIRED",
  message: "Please select a specific subject.",
});
