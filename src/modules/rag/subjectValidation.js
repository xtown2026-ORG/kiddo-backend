import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";

loadEnv();

const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").replace(/^models\//, "");
let subjectClassifierAi = null;

const getSubjectClassifierAi = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  subjectClassifierAi ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return subjectClassifierAi;
};

const SUBJECTS = Object.freeze({
  maths: "Maths",
  math: "Maths",
  mathematics: "Maths",
  mathematics_subject: "Maths",
  math_subject: "Maths",
  maths_subject: "Maths",
  school_mathematics: "Maths",
  school_math: "Maths",
  school_maths: "Maths",
  physics: "Physics",
  physics_subject: "Physics",
  chemistry: "Chemistry",
  chemistry_subject: "Chemistry",
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
    /\b(?:maths?|mathematics|algebra|geometry|trigonometry|calculus|arithmetic|quadratic|polynomial|factor(?:ise|ize|isation|ization)?|probability|permutation|combination|fraction|decimal|percentage|percent|ratio|proportion|average|mean|median|mode|perimeter|area|volume|circumference|diameter|radius|hypotenuse|integer|prime|composite|natural\s+number|whole\s+number|rational\s+number|irrational\s+number|odd\s+number|even\s+number|roman\s+numerals?|matrix|determinant|logarithm|number\s+system|place\s+value|face\s+value|expanded\s+form|standard\s+form|scientific\s+notation|successor|predecessor|multiple|hcf|lcm|gcd|square\s+root|cube\s+root|square|cube|coordinate\s+geometry|linear\s+equation|simultaneous\s+equations?|inequalit(?:y|ies)|mensuration|statistics|histogram|bar\s+graph|pie\s+chart|arithmetic\s+progression|geometric\s+progression|sequence|series|limits?|derivatives?|differentiation|integrals?|integration|vectors?|sets?|venn\s+diagram)\b/i,
    /(?:^|\s)(?:solve|find\s+the\s+roots?|simplify|evaluate|differentiate|integrate)\b[^\n]*(?:[=<>]|\b(?:sin|cos|tan)\b)/i,
    /\b[xyz]\s*(?:\^|[\u00b2\u00b3]|\*\*)?\s*\d*\s*[+\-=<>]/i,
    /\d\s*(?:[+\-*/\u00d7\u00f7]|x)\s*\d/i,
    /\d\s*%\s*(?:of\s*)?\d|\bpercentage\b[^\n]*\d|\d[^\n]*\bpercentage\b/i,
    /(?:\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b[^\n]*\d|\d[^\n]*\b(?:largest|smallest|greatest|least|ascending|descending|greater|lesser)\b)/i,
    /\b(?:compare|arrange|order)\b[^\n]*\d/i,
    /\b(?:sum|difference|product|quotient|total|altogether|remaining|left|more\s+than|less\s+than|each|equal\s+parts?|share|cost|price|amount|due|saving|savings|spent|spend|credit|debit|bill|banking|discount|tax|interest)\b[^\n]*(?:\d|₹|rs\.?|inr)|(?:\d|₹|rs\.?|inr)[^\n]*\b(?:sum|difference|product|quotient|total|altogether|remaining|left|more\s+than|less\s+than|each|equal\s+parts?|share|cost|price|amount|due|saving|savings|spent|spend|credit|debit|bill|banking|discount|tax|interest)\b/i,
    /\b(?:formula|find|calculate)\b[^\n]*\b(?:area|perimeter|volume|circumference|radius|diameter|simple\s+interest|compound\s+interest|profit|loss|discount)\b/i,
    /\b(?:how\s+many\s+(?:ways|arrangements?)|number\s+of\s+(?:ways|arrangements?)|can\s+be\s+(?:arranged|formed)|without\s+repetition|with\s+repetition|factorial|n\s*[pc]\s*r)\b/i,
    /\b(?:\d+\s*-?\s*digit\s+numbers?|digits?|possible\s+numbers?|using\s+the\s+digits?|numbers?\s+(?:can|could)\s+(?:be\s+)?(?:formed|written|made)|write\s+(?:all\s+)?(?:the\s+)?possible\s+numbers?)\b/i,
  ],
  Physics: [
    /\b(?:physics|kinematics|dynamics|velocity|acceleration|momentum|inertia|force|newton(?:'s)?\s+law|kinetic\s+energy|potential\s+energy|work\s+done|power|gravity|gravitational|friction|pressure|density|displacement|distance|speed|time|current|voltage|resistance|ohm(?:'s)?\s+law|electric(?:ity|al)?|magnetism|magnetic|wavelength|frequency|refraction|reflection|lens|mirror|optics|thermodynamics|heat|temperature|gas\s+law|boyle'?s\s+law|charles'?s\s+law|ideal\s+gas|constant\s+pressure|constant\s+temperature|scalar|vector|projectile|circular\s+motion|torque|equilibrium|fluid\s+mechanics|buoyancy|specific\s+heat|latent\s+heat|calorimetry|wave|sound|light|ray\s+diagram|electromagnetic|photoelectric|semiconductor|nuclear\s+physics|radioactivity)\b/i,
    /\b(?:kg|newtons?|joules?|watts?|volts?|amperes?|ohms?|hertz|tesla|weber|pascal|coulomb|metres?\s+per\s+second|m\/s|m\/s[\u00b2^2]*|n\/c|v\/m)\b/i,
  ],
  Chemistry: [
    /\b(?:chemistry|chemical|atoms?|atomic|molecules?|molecular|elements?|compounds?|periodic\s+table|valency|moles?|mol|mmol|molarity|molality|density|gas\s+law|boyle'?s\s+law|charles'?s\s+law|ideal\s+gas|states?\s+of\s+matter|solute|solvent|solution|concentration|acids?(?:\s+and\s+bases?)?|bases?\s+and\s+acids?|chemical\s+bases?|alkali|salt|ph|oxidation|reduction|redox|covalent|ionic|bond|isotope|electron\s+configuration|stoichiometry|titration|electrolysis|catalyst|hydrocarbon|organic\s+chemistry|inorganic\s+chemistry|physical\s+chemistry|metals?|non-?metals?|alloys?|reactants?|products?|chemical\s+reaction|chemical\s+equation|combustion|neutralisation|neutralization|crystallisation|crystallization|chromatography|polymer|functional\s+group|alkanes?|alkenes?|alkynes?|alcohols?|carboxylic\s+acids?|ester|benzene|enthalpy|equilibrium|ionic\s+product|solubility\s+product)\b/i,
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
const COMMERCIAL_ARITHMETIC_CONTEXT_PATTERN =
  /\b(?:saving|savings|saved|spent|spend|borrowed|lent|paid|cost|price|amount|due|credit|debit|bill|banking|discount|tax|interest|profit|loss|purchase|sale)\b/i;
const ACCOUNTING_RECORD_CONTEXT_PATTERN =
  /\b(?:journal(?:ise|ize|isation|ization)?|journal\s+entr(?:y|ies)|ledger|trial\s+balance|balance\s+sheet|cash\s+book|bank\s+reconciliation|assets?|liabilit(?:y|ies)|capital\s+account|depreciation|goodwill|profit\s+and\s+loss|trading\s+account|final\s+accounts?|bills?\s+(?:receivable|payable))\b/i;
const INDIAN_NUMBER_SYSTEM_CONTEXT_PATTERN =
  /\b(?:place\s+value|face\s+value|indian\s+number\s+system|international\s+number\s+system|lakhs?|lacs?|crores?|thousands?|hundreds?|ten\s+thousands?|ten\s+lakhs?|millions?|billions?)\b/i;
const NUMBER_SYSTEM_CONVERSION_INTENT_PATTERN =
  /\b(?:how\s+many|are\s+there\s+in|convert|conversion|express|write|represent|rename|number\s+of|value\s+of|expanded\s+form|standard\s+form|short\s+form|periods?|places?)\b/i;
const MATH_REPRESENTATION_INTENT_PATTERN =
  /\b(?:express|write|convert|represent|rewrite|round|approximate)\b/i;
const MATH_REPRESENTATION_TOPIC_PATTERN =
  /\b(?:scientific\s+notation|notation|standard\s+form|expanded\s+form|exponential\s+form|powers?\s+of\s*10|indices|index|exponents?|logarithms?|place\s+value|significant\s+figures?)\b/i;
const NUMERIC_OR_MONEY_PATTERN = /(?:\d|₹|rs\.?|inr)/i;
const SEMANTIC_SUBJECTS = new Set(["Maths", "Physics", "Chemistry", "Other Subjects"]);
const SUBJECT_CLASSIFIER_CONFIG = Object.freeze({
  temperature: 0,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      subject: {
        type: "string",
        enum: ["Maths", "Physics", "Chemistry", "Other Subjects"],
      },
      confidence: {
        type: "number",
      },
    },
    required: ["subject"],
  },
});

const isCommercialArithmeticQuestion = (question) => {
  const text = String(question || "");
  return (
    NUMERIC_OR_MONEY_PATTERN.test(text) &&
    COMMERCIAL_ARITHMETIC_CONTEXT_PATTERN.test(text) &&
    !ACCOUNTING_RECORD_CONTEXT_PATTERN.test(text)
  );
};

const isStandaloneMathRepresentationQuestion = (question, scores = getSubjectScores(question)) => {
  const text = String(question || "");
  const hasScienceContext = (scores.Physics || 0) > 0 || (scores.Chemistry || 0) > 0;

  return (
    NUMERIC_OR_MONEY_PATTERN.test(text) &&
    MATH_REPRESENTATION_INTENT_PATTERN.test(text) &&
    MATH_REPRESENTATION_TOPIC_PATTERN.test(text) &&
    !hasScienceContext
  );
};

const isNumberSystemConversionQuestion = (question, scores = getSubjectScores(question)) => {
  const text = String(question || "");
  const hasScienceContext = (scores.Physics || 0) > 0 || (scores.Chemistry || 0) > 0;
  const numberSystemMatches = text.match(
    new RegExp(INDIAN_NUMBER_SYSTEM_CONTEXT_PATTERN.source, "gi")
  ) || [];

  return (
    !hasScienceContext &&
    numberSystemMatches.length >= 2 &&
    NUMBER_SYSTEM_CONVERSION_INTENT_PATTERN.test(text) &&
    NUMERIC_OR_MONEY_PATTERN.test(text)
  );
};

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

const RAW_PLACEHOLDER_PATTERN = /^\s*\{\{\s*(?:selected_subject|selectedSubject|question)\s*\}\}\s*$/i;

const hasSubjectValidationInput = (value) => {
  const text = String(value ?? "").trim();
  return Boolean(text) && !RAW_PLACEHOLDER_PATTERN.test(text);
};

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

  if (isCommercialArithmeticQuestion(text)) {
    return "Maths";
  }

  if (isStandaloneMathRepresentationQuestion(text, scores)) {
    return "Maths";
  }

  if (isNumberSystemConversionQuestion(text, scores)) {
    return "Maths";
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
    (!candidates.size ||
      EXPLICIT_MATHS_PATTERN.test(text) ||
      NUMERIC_MATHS_STRUCTURE_PATTERN.test(text) ||
      isCommercialArithmeticQuestion(text) ||
      isStandaloneMathRepresentationQuestion(text, scores) ||
      isNumberSystemConversionQuestion(text, scores))
  ) {
    candidates.add("Maths");
  }

  if (isNumberSystemConversionQuestion(text, scores)) {
    candidates.add("Maths");
  }

  if (isStandaloneMathRepresentationQuestion(text, scores)) {
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

const buildSemanticSubjectPrompt = ({ question, selectedSubject }) =>
  [
    "You are a strict academic subject classifier for Indian school Classes 6-12.",
    "Classify the user's question by the school subject it actually belongs to.",
    "",
    "Allowed labels:",
    "- Maths",
    "- Physics",
    "- Chemistry",
    "- Other Subjects",
    "",
    "Rules:",
    "1. Do not solve the question.",
    "2. Classify by academic topic and required reasoning, not by keywords alone.",
    "3. Numbers, equations, units, symbols, or chemical-looking letters are not enough by themselves.",
    "4. Arithmetic, place value, Indian/international number systems, lakh/crore/thousand conversions, number systems, algebra, geometry, mensuration, statistics, probability, calculus, percentages, ratios, fractions, decimals, scientific notation, and commercial/financial arithmetic are Maths.",
    "5. Motion, force, energy, electricity, magnetism, waves, optics, heat, pressure, and physical measurements in a physics context are Physics.",
    "6. Atoms, molecules, elements, compounds, reactions, equations, periodic table, bonding, acids/bases, moles, solutions, and organic/inorganic chemistry are Chemistry.",
    "7. School-level money word problems about savings, spending, credit/debit amounts, dues, bills, banking arithmetic, discounts, profit/loss, tax, or interest are Maths when the task is to calculate a value.",
    "8. Accounting is Other Subjects only when the task is about accounting concepts or records such as journal entries, ledgers, trial balance, balance sheet, assets, liabilities, or final accounts.",
    "9. Pure representation/manipulation of a number or algebraic expression, such as writing in scientific notation or another notation/form, powers of 10, exponents/indices, logarithmic form, place value, Indian number system conversion, rounding, or significant figures, is Maths when there is no physics or chemistry concept, unit, quantity, formula, or measurement context.",
    "10. Shared notation belongs to Physics only when it is used inside a physics problem involving physical quantities, units, measurements, formulas, or concepts.",
    "11. Shared notation belongs to Chemistry only when it is used inside a chemistry problem involving chemical quantities, substances, formulas, equations, moles, atoms, molecules, or reactions.",
    "12. Biology, English, social science, commerce theory, accounting records, coding, general knowledge, or unclear non-Maths/Physics/Chemistry questions are Other Subjects.",
    "13. If a question is interdisciplinary, choose the subject a school student would open to solve it.",
    "",
    "Return only compact JSON with this exact shape:",
    '{"subject":"Maths|Physics|Chemistry|Other Subjects","confidence":0.0}',
    "",
    "Selected Subject:",
    String(selectedSubject || "").trim(),
    "",
    "Student Question:",
    String(question || "").trim(),
  ].join("\n");

const buildSemanticSubjectRepairPrompt = ({ question, previousOutput }) =>
  [
    "Return only valid compact JSON for this academic subject classification.",
    "Allowed subject values are exactly: Maths, Physics, Chemistry, Other Subjects.",
    "Choose the primary school subject by educational context, not shared notation or isolated words.",
    "Do not solve the question.",
    "",
    "Question:",
    String(question || "").trim(),
    "",
    "Previous invalid or ambiguous output:",
    String(previousOutput || "").trim(),
    "",
    "Required JSON shape:",
    '{"subject":"Maths|Physics|Chemistry|Other Subjects","confidence":0.0}',
  ].join("\n");

const extractRawGeminiText = (result) => {
  const text = typeof result?.text === "function" ? result.text() : result?.text;
  return text || result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || "";
};

const parseSemanticClassification = (value) => {
  const text = String(value || "").trim();
  if (!text) return { rawSubject: null, subject: null, confidence: null };

  try {
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonText);
    const rawSubject = parsed?.subject ? String(parsed.subject).trim() : null;
    return {
      rawSubject,
      subject: normalizeSemanticSubjectLabel(rawSubject),
      confidence: normalizeConfidenceScore(parsed?.confidence),
    };
  } catch {
    return {
      rawSubject: text,
      subject: normalizeSemanticSubjectLabel(text),
      confidence: null,
    };
  }
};

const parseSemanticSubject = (value) => parseSemanticClassification(value).subject;

const normalizeSemanticSubjectLabel = (subject) => {
  const normalized = String(subject || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

  if (!normalized) return null;
  if (/^(?:school\s+)?(?:maths?|mathematics)(?:\s+subject)?$/.test(normalized)) return "Maths";
  if (/^physics(?:\s+subject)?$/.test(normalized)) return "Physics";
  if (/^chemistry(?:\s+subject)?$/.test(normalized)) return "Chemistry";
  if (/\bother(?:\s+subjects?)?\b/.test(normalized)) return "Other Subjects";
  return null;
};

const normalizeConfidenceScore = (confidence) => {
  const score = Number(confidence);
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null;
};

const detectFallbackSemanticSubject = (question) => {
  const detectedSubject = detectQuestionSubject(question);
  const normalizedSubject = normalizeSelectedSubject(detectedSubject);

  if (PRIMARY_VALIDATION_SUBJECTS.has(normalizedSubject)) {
    return normalizedSubject;
  }

  return detectedSubject ? "Other Subjects" : null;
};

const buildClassificationResult = ({ rawSubject = null, subject, confidence = null, source }) => ({
  rawSubject: rawSubject ?? subject ?? null,
  subject,
  confidence,
  source,
});

const runSubjectClassifier = async (prompt) => {
  const ai = getSubjectClassifierAi();
  if (!ai) return null;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: SUBJECT_CLASSIFIER_CONFIG,
  });
  return extractRawGeminiText(result);
};

const classifyQuestionSubjectSemantically = async ({ question, selectedSubject, classifier } = {}) => {
  const prompt = buildSemanticSubjectPrompt({ question, selectedSubject });

  if (classifier) {
    const rawText = await classifier({ question, selectedSubject, prompt });
    const classification = parseSemanticClassification(rawText);
    if (classification.subject) {
      return buildClassificationResult({ ...classification, source: "semantic" });
    }

    const repairPrompt = buildSemanticSubjectRepairPrompt({ question, previousOutput: rawText });
    return buildClassificationResult({
      ...parseSemanticClassification(await classifier({ question, selectedSubject, prompt: repairPrompt })),
      source: "semantic",
    });
  }

  if (!getSubjectClassifierAi()) {
    return buildClassificationResult({
      rawSubject: detectFallbackSemanticSubject(question),
      subject: detectFallbackSemanticSubject(question),
      source: "fallback",
    });
  }

  try {
    const rawText = await runSubjectClassifier(prompt);
    const classification = parseSemanticClassification(rawText);
    if (classification.subject) {
      return buildClassificationResult({ ...classification, source: "semantic" });
    }

    const repairPrompt = buildSemanticSubjectRepairPrompt({ question, previousOutput: rawText });
    return buildClassificationResult({
      ...parseSemanticClassification(await runSubjectClassifier(repairPrompt)),
      source: "semantic",
    });
  } catch (error) {
    console.error("SUBJECT_CLASSIFIER_FAILED", error?.status || "", error?.message || error);
    return buildClassificationResult({
      rawSubject: detectFallbackSemanticSubject(question),
      subject: detectFallbackSemanticSubject(question),
      source: "fallback",
    });
  }
};

export const detectQuestionSubjectSemantically = async ({ question, classifier } = {}) =>
  (await classifyQuestionSubjectSemantically({ question, classifier })).subject;

export const validateGeminiSolverSubject = async ({
  question,
  selectedSubject,
  subject,
  classifier,
} = {}) => {
  const providedSelectedSubject = getProvidedSubject(selectedSubject, subject);

  if (!hasSubjectValidationInput(providedSelectedSubject) || !hasSubjectValidationInput(question)) {
    return {
      isMatch: false,
      shouldReject: true,
      isInvalidInput: true,
      selectedSubject: normalizeSelectedSubject(providedSelectedSubject),
      detectedSubject: "Unknown",
      confidenceScore: null,
      solverAllowed: false,
    };
  }

  const normalizedSelectedSubject = normalizeSelectedSubject(providedSelectedSubject);
  const shouldSkipSubjectValidation = normalizedSelectedSubject === "Other Subjects";

  if (shouldSkipSubjectValidation || !PRIMARY_VALIDATION_SUBJECTS.has(normalizedSelectedSubject)) {
    return {
      isMatch: true,
      shouldReject: false,
      selectedSubject: normalizedSelectedSubject,
      detectedSubject: null,
    };
  }

  console.log("SUBJECT_VALIDATION_INPUT:", {
    selectedSubject: String(providedSelectedSubject || "").trim(),
    question: String(question || "").trim(),
  });

  const classification = await classifyQuestionSubjectSemantically({
    question,
    selectedSubject: providedSelectedSubject,
    classifier,
  });
  const rawDetectedSubject = classification.rawSubject;
  const normalizedDetectedSubject = classification.subject;
  const solverAllowed = normalizedDetectedSubject === normalizedSelectedSubject;
  const shouldReject = !solverAllowed;
  const validationResult = shouldReject ? "MISMATCH" : "MATCH";

  console.log(`QUESTION_TEXT = ${String(question || "").trim()}`);
  console.log(`RAW_DETECTED_SUBJECT = ${rawDetectedSubject || "Unknown"}`);
  console.log(`NORMALIZED_DETECTED_SUBJECT = ${normalizedDetectedSubject || "Unknown"}`);
  console.log(`SELECTED_SUBJECT = ${normalizedSelectedSubject || "Unknown"}`);
  console.log(`VALIDATION_RESULT = ${validationResult}`);
  console.log(`SOLVER_ALLOWED = ${solverAllowed}`);
  console.log(`CONFIDENCE_SCORE = ${classification.confidence ?? "Unknown"}`);

  return {
    isMatch: solverAllowed,
    shouldReject,
    selectedSubject: normalizedSelectedSubject,
    rawDetectedSubject,
    detectedSubject: normalizedDetectedSubject,
    confidenceScore: classification.confidence,
    solverAllowed,
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

export const SUBJECT_INVALID_INPUT_RESPONSE = Object.freeze({
  detected_subject: "Unknown",
  confidence: "low",
  validation: "INVALID_INPUT",
  message: "Missing subject or question input.",
});
