import assert from "node:assert/strict";
import test from "node:test";

import {
  detectQuestionSubject,
  normalizeRequestSubject,
  normalizeSelectedSubject,
  resolveQuestionSubject,
  SUBJECT_MISMATCH_RESPONSE,
  SUBJECT_REQUIRED_RESPONSE,
  validateQuestionSubject,
} from "./subjectValidation.js";

test("detects all supported subjects", () => {
  assert.equal(detectQuestionSubject("Solve x^2 - 2x - 1 = 0"), "Maths");
  assert.equal(detectQuestionSubject("Find the kinetic energy of a 2 kg body"), "Physics");
  assert.equal(detectQuestionSubject("Calculate the molarity of the NaCl solution"), "Chemistry");
  assert.equal(detectQuestionSubject("Prepare the trial balance from the ledger"), "Accounts");
  assert.equal(detectQuestionSubject("Explain the law of demand in a market"), "Commerce");
});

test("detects numeric largest and smallest questions as Maths", () => {
  const question =
    "Of the numbers 1386787215, 137698890, 86720560, which one is the largest? Which one is the smallest?";

  assert.equal(detectQuestionSubject(question), "Maths");
  assert.equal(
    validateQuestionSubject({ question, selectedSubject: "Maths" }).shouldReject,
    false
  );
});

test("accepts a matching selected subject", () => {
  assert.equal(
    validateQuestionSubject({
      question: "Calculate force when mass is 5 kg and acceleration is 2 m/s^2",
      subject: "Physics",
    }).isMatch,
    true
  );
});

test("rejects a mismatching selected subject", () => {
  const result = validateQuestionSubject({
    question: "Balance H2 + O2 -> H2O",
    subject: "Maths",
  });

  assert.equal(result.isMatch, false);
  assert.equal(result.shouldReject, true);
  assert.equal(result.detectedSubject, "Chemistry");
});

test("does not apply mismatch validation without a subject-button selection", () => {
  const result = validateQuestionSubject({
    question: "Find the kinetic energy of the object",
  });

  assert.equal(result.shouldReject, false);
  assert.equal(result.isMatch, true);
});

test("allows a selected subject when detection is not confident", () => {
  const result = validateQuestionSubject({
    question: "Explain this topic in simple words",
    subject: "Physics",
  });

  assert.equal(result.detectedSubject, null);
  assert.equal(result.shouldReject, false);
  assert.equal(result.isMatch, true);
});

test("allows permutation-style Maths questions without an explicit subject label", () => {
  const questions = [
    "In how many ways can 5 students be seated in a row?",
    "How many four-digit numbers can be formed from 1, 2, 3, 4 without repetition?",
  ];

  for (const question of questions) {
    const result = validateQuestionSubject({ question, selectedSubject: "Maths" });
    assert.equal(result.detectedSubject, "Maths");
    assert.equal(result.shouldReject, false);
  }
});

test("selected Maths accepts common Maths questions without an explicit subject label", () => {
  const questions = [
    "Find the value of 45 x 28",
    "Arrange 56, 78, 12, and 90 in descending order",
    "How many three digit numbers can be formed using 1, 2, 3 without repetition?",
    "What is the formula for area of a rectangle?",
    "Define rational number",
    "A shopkeeper sold 24 pencils in the morning and 18 pencils in the evening. How many pencils did he sell altogether?",
  ];

  for (const question of questions) {
    const result = validateQuestionSubject({ question, selectedSubject: "Maths" });
    assert.equal(result.detectedSubject, "Maths");
    assert.equal(result.shouldReject, false);
  }
});

test("rejects common Maths questions when Physics or Chemistry is selected", () => {
  const cases = [
    {
      question: "Find the value of 45 x 28",
      selectedSubject: "Physics",
    },
    {
      question: "Arrange 56, 78, 12, and 90 in descending order",
      selectedSubject: "Chemistry",
    },
    {
      question: "How many three digit numbers can be formed using 1, 2, 3 without repetition?",
      selectedSubject: "Physics",
    },
    {
      question: "What is the formula for area of a rectangle?",
      selectedSubject: "Chemistry",
    },
    {
      question: "Define rational number",
      selectedSubject: "Physics",
    },
    {
      question: "A shopkeeper sold 24 pencils in the morning and 18 pencils in the evening. How many pencils did he sell altogether?",
      selectedSubject: "Chemistry",
    },
  ];

  for (const testCase of cases) {
    const result = validateQuestionSubject(testCase);
    assert.equal(result.detectedSubject, "Maths");
    assert.equal(result.shouldReject, true);
  }
});

test("treats digit-formation questions as Maths only", () => {
  const question =
    "Rajan writes a 3-digit number, using the digits 4, 7 and 9. What are the possible numbers he can write?";

  assert.equal(detectQuestionSubject(question), "Maths");
  assert.equal(
    validateQuestionSubject({ question, selectedSubject: "Maths" }).shouldReject,
    false
  );
  assert.equal(
    validateQuestionSubject({ question, selectedSubject: "Physics" }).shouldReject,
    true
  );
  assert.equal(
    validateQuestionSubject({ question, selectedSubject: "Chemistry" }).shouldReject,
    true
  );
});

test("accepts valid selected-subject Gemini Solver questions", () => {
  const cases = [
    {
      question: "Find the area of a triangle with base 10 cm and height 5 cm.",
      selectedSubject: "Maths",
    },
    {
      question: "A body travels with velocity 20 m/s. Find its kinetic energy.",
      selectedSubject: "Physics",
    },
    {
      question: "Calculate density when mass is 50g and volume is 10cm³.",
      selectedSubject: "Chemistry",
    },
    {
      question: "A substance has a mass of 50g and volume of 10cm³. Find density.",
      selectedSubject: "Chemistry",
    },
  ];

  for (const testCase of cases) {
    const result = validateQuestionSubject(testCase);
    assert.equal(result.shouldReject, false);
    assert.equal(result.isMatch, true);
  }
});

test("rejects clear cross-subject questions before Gemini Solver", () => {
  const cases = [
    {
      question: "Solve x + 5 = 10.",
      selectedSubject: "Physics",
      detectedSubject: "Maths",
    },
    {
      question: "Explain atoms and molecules.",
      selectedSubject: "Maths",
      detectedSubject: "Chemistry",
    },
    {
      question: "Explain photosynthesis.",
      selectedSubject: "Maths",
      detectedSubject: "Biology",
    },
  ];

  for (const testCase of cases) {
    const result = validateQuestionSubject(testCase);
    assert.equal(result.detectedSubject, testCase.detectedSubject);
    assert.equal(result.shouldReject, true);
    assert.equal(result.isMatch, false);
  }
});

test("matches broad Maths Physics and Chemistry curriculum questions", () => {
  const cases = [
    {
      question: "Find the derivative of sin x with respect to x.",
      selectedSubject: "Maths",
      detectedSubject: "Maths",
    },
    {
      question: "Draw a histogram for the given class intervals and frequencies.",
      selectedSubject: "Maths",
      detectedSubject: "Maths",
    },
    {
      question: "Calculate the equivalent resistance of two resistors connected in parallel.",
      selectedSubject: "Physics",
      detectedSubject: "Physics",
    },
    {
      question: "Explain total internal reflection in optical fibres.",
      selectedSubject: "Physics",
      detectedSubject: "Physics",
    },
    {
      question: "Balance the chemical equation for magnesium reacting with oxygen.",
      selectedSubject: "Chemistry",
      detectedSubject: "Chemistry",
    },
    {
      question: "Find the empirical formula of a compound from its percentage composition.",
      selectedSubject: "Chemistry",
      detectedSubject: "Chemistry",
    },
  ];

  for (const testCase of cases) {
    const result = validateQuestionSubject(testCase);
    assert.equal(result.detectedSubject, testCase.detectedSubject);
    assert.equal(result.shouldReject, false);
    assert.equal(result.isMatch, true);
  }
});

test("button-selected subject has priority over text detection", () => {
  assert.deepEqual(
    resolveQuestionSubject({
      question: "Explain chemistry in simple words",
      selectedSubject: "Physics",
    }),
    { subject: "Physics", source: "selected" }
  );
});

test("normalizes other_subjects and skips mismatch validation for it", () => {
  assert.equal(normalizeSelectedSubject("other_subjects"), "Other Subjects");
  assert.equal(normalizeSelectedSubject("Other Subjects"), "Other Subjects");
  assert.equal(normalizeSelectedSubject("other subjects"), "Other Subjects");
  assert.equal(normalizeRequestSubject("other_subjects"), "Other Subjects");
  assert.equal(normalizeRequestSubject("Other Subjects"), "Other Subjects");
  assert.equal(normalizeRequestSubject("accounts"), null);

  const result = validateQuestionSubject({
    question: "Balance H2 + O2 -> H2O",
    selectedSubject: "other_subjects",
  });

  assert.equal(result.selectedSubject, "Other Subjects");
  assert.equal(result.detectedSubject, "Chemistry");
  assert.equal(result.shouldReject, false);
  assert.equal(result.isMatch, true);
});

test("other subjects routing validation accepts fallback subject field and general questions", () => {
  assert.deepEqual(
    resolveQuestionSubject({
      question: "Dr. A.P.J. Abdul Kalam",
      selectedSubject: "",
      subject: "other_subjects",
    }),
    { subject: "Other Subjects", source: "selected" }
  );

  const result = validateQuestionSubject({
    question: "Dr. A.P.J. Abdul Kalam",
    selectedSubject: "",
    subject: "Other Subjects",
  });

  assert.equal(result.selectedSubject, "Other Subjects");
  assert.equal(result.shouldReject, false);
});

test("subject validation responses use required routing messages", () => {
  assert.equal(SUBJECT_REQUIRED_RESPONSE.message, "Please select a specific subject.");
  assert.equal(SUBJECT_MISMATCH_RESPONSE.message, "The selected subject does not match the question.");
});

test("legacy subject field also triggers button-subject resolution", () => {
  assert.deepEqual(
    resolveQuestionSubject({ question: "What is velocity?", subject: "Physics" }),
    { subject: "Physics", source: "selected" }
  );
});

test("falls back to question-text detection without a selected subject", () => {
  assert.deepEqual(
    resolveQuestionSubject({ question: "Solve this in maths: 2x + 1 = 5" }),
    { subject: "Maths", source: "detected" }
  );
});

test("blocks English questions submitted with a Maths button", () => {
  const result = validateQuestionSubject({
    question: "Identify the noun and adjective in this English sentence",
    selectedSubject: "Maths",
  });

  assert.equal(result.detectedSubject, "English");
  assert.equal(result.shouldReject, true);
});

test("blocks Social Science questions submitted with a Physics button", () => {
  const result = validateQuestionSubject({
    question: "Explain the fundamental rights in the Constitution",
    selectedSubject: "Physics",
  });

  assert.equal(result.detectedSubject, "Social Science");
  assert.equal(result.shouldReject, true);
});

test("treats each validation call independently", () => {
  assert.equal(
    validateQuestionSubject({ question: "Solve 2x + 4 = 10", subject: "Maths" }).isMatch,
    true
  );
  assert.equal(
    validateQuestionSubject({ question: "State Ohm's law", subject: "Chemistry" }).isMatch,
    false
  );
});
