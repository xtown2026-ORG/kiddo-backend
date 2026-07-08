import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPostRagExplanationPrompt,
  normalizePostRagExplanationMode,
} from "./postRagExplanation.service.js";

test("normalizes supported post-RAG explanation modes", () => {
  assert.equal(normalizePostRagExplanationMode("short"), "short");
  assert.equal(normalizePostRagExplanationMode(" Brief "), "brief");
  assert.equal(normalizePostRagExplanationMode("long"), null);
});

test("builds a strict prompt using only the original question", () => {
  const prompt = buildPostRagExplanationPrompt({
    originalQuestion: "What is evaporation?",
    mode: "short",
  });

  assert.match(prompt, /Original question:\nWhat is evaporation\?/);
  assert.match(prompt, /Never answer another question/);
  assert.match(prompt, /Only explain the original question/);
  assert.match(prompt, /Return 3 to 5 concise points/);
  assert.match(prompt, /Return plain text only/);
  assert.doesNotMatch(prompt, /retrieval|embedding|vector|chroma/i);
});

test("brief mode asks for progressive clear points", () => {
  const prompt = buildPostRagExplanationPrompt({
    originalQuestion: "Explain water cycle.",
    mode: "brief",
  });

  assert.match(prompt, /Return 10 to 15 clear points/);
  assert.match(prompt, /explain progressively with logical flow/);
});
