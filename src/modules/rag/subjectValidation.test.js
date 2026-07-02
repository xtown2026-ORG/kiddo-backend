import assert from "node:assert/strict";
import test from "node:test";

import {
  detectQuestionSubject,
  resolveQuestionSubject,
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

test("rejects a selected subject when detection is not confident", () => {
  const result = validateQuestionSubject({
    question: "Explain this topic in simple words",
    subject: "Physics",
  });

  assert.equal(result.detectedSubject, null);
  assert.equal(result.shouldReject, true);
  assert.equal(result.isMatch, false);
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
