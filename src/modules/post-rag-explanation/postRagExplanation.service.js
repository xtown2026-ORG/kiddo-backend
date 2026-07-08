import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").replace(
  /^models\//,
  ""
);

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const MODE_RULES = Object.freeze({
  short: {
    pointCount: "3-5",
    instruction: "Return 3 to 5 concise points.",
  },
  brief: {
    pointCount: "10-15",
    instruction: "Return 10 to 15 clear points that explain progressively with logical flow.",
  },
});

export const normalizePostRagExplanationMode = (mode) => {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  return MODE_RULES[normalizedMode] ? normalizedMode : null;
};

export const buildPostRagExplanationPrompt = ({ originalQuestion, mode }) => {
  const normalizedMode = normalizePostRagExplanationMode(mode);
  const rules = MODE_RULES[normalizedMode];

  if (!rules) {
    throw new Error("Invalid explanation mode.");
  }

  return [
    "You are explaining the same question that the user originally asked.",
    "Never answer another question.",
    "Never introduce unrelated facts.",
    "Never hallucinate.",
    "Never change the topic.",
    "Only explain the original question.",
    "",
    "Safety rules:",
    "Never generate content outside the user's original question.",
    "Never answer a different topic.",
    "Never infer missing topics.",
    "If the question is ambiguous, explain only what is directly asked.",
    "",
    `Mode: ${normalizedMode}`,
    rules.instruction,
    "Use simple language.",
    "No unnecessary introduction.",
    "No conclusion.",
    "No markdown tables.",
    "No markdown formatting.",
    "Do not use bullet symbols or numbered list markers.",
    "Write each point as a simple sentence on its own line.",
    "No code blocks.",
    "No unrelated information.",
    "Return plain text only.",
    "",
    "Original question:",
    String(originalQuestion || "").trim(),
  ].join("\n");
};

const sanitizePlainText = (value) =>
  String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractGeminiText = (result) => {
  const text = typeof result?.text === "function" ? result.text() : result?.text;
  return (
    text ||
    result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") ||
    ""
  );
};

export const logPostRagExplanationError = (label, err) => {
  console.error(label, {
    message: err?.message || String(err),
    stack: err?.stack,
    geminiResponse:
      err?.response?.data ||
      err?.response ||
      err?.errorDetails ||
      err?.details ||
      err?.cause?.response?.data ||
      err?.cause?.response ||
      null,
  });
};

export const generatePostRagExplanation = async ({ originalQuestion, mode }) => {
  try {
    const cleanedQuestion = String(originalQuestion || "").trim();
    const normalizedMode = normalizePostRagExplanationMode(mode);

    if (!cleanedQuestion) {
      const err = new Error("originalQuestion is required.");
      err.statusCode = 400;
      throw err;
    }

    if (!normalizedMode) {
      const err = new Error("mode must be short or brief.");
      err.statusCode = 400;
      throw err;
    }

    if (!ai) {
      const err = new Error("Explanation generator is unavailable.");
      err.statusCode = 503;
      throw err;
    }

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPostRagExplanationPrompt({
        originalQuestion: cleanedQuestion,
        mode: normalizedMode,
      }),
    });

    return sanitizePlainText(extractGeminiText(result));
  } catch (err) {
    logPostRagExplanationError("POST_RAG_EXPLANATION_SERVICE_ERROR", err);
    throw err;
  }
};
