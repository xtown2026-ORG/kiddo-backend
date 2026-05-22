import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

loadEnv();

const VALID_FOLLOWUP_TYPES = new Set(["picture", "architecture", "example", "label_diagram", "timeline"]);
const VALID_FOLLOWUP_TYPE_MESSAGE = "picture, architecture, example, label_diagram, timeline";
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "../../../");
export const FOLLOWUP_UPLOAD_DIR = path.join(PROJECT_ROOT, "uploads", "ai-followups");
const FOLLOWUP_UPLOAD_URL = "/api/ai-followup/uploads/ai-followups";
const GEMINI_MODEL = (process.env.GEMINI_FOLLOWUP_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").replace(
  /^models\//,
  ""
);
const GEMINI_IMAGE_MODEL = (process.env.GEMINI_IMAGE_MODEL || "imagen-4.0-generate-001").replace(/^models\//, "");
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const normalizeText = (value) => String(value || "").trim();

const getFollowupInstructions = (followupType) => {
  if (followupType === "picture") {
    return [
      "Generate only a short caption for a real educational image about the same previous question and topic.",
      "Do not create ASCII art, markdown diagrams, code fences, pseudo-images, or text pretending to be a picture.",
      "Keep the caption to one simple student-friendly sentence.",
      "Do not generate unrelated content.",
    ].join("\n");
  }

  if (followupType === "architecture") {
    return [
      "Generate a structure or architecture explanation.",
      "Use flow structure, components, relationships, and ordered working steps.",
      "Use an arrow-flow format where helpful.",
      "Do not generate unrelated content.",
    ].join("\n");
  }

  if (followupType === "label_diagram") {
    return [
      "Generate a labeled diagram-style explanation for the same topic.",
      "Use a clear title.",
      "Use a diagram-style layout with labels, arrows, parts, and functions.",
      "Explain each labeled part in a simple student-friendly way.",
      "Do not generate unrelated content.",
    ].join("\n");
  }

  if (followupType === "timeline") {
    return [
      "Generate a timeline-style explanation for the same topic.",
      "Use an ordered sequence with time or order flow.",
      "Use arrows to connect stages, events, or steps.",
      "Add a simple explanation for each stage.",
      "Do not generate unrelated content.",
    ].join("\n");
  }

  return [
    "Generate a student-friendly explanation with simple examples related to the same topic.",
    "Keep examples clear, concrete, and directly connected to the previous question and answer.",
    "Do not generate unrelated content.",
  ].join("\n");
};

const buildPrompt = ({ originalQuestion, previousAnswer, followupType }) => `
You are an academic follow-up explanation assistant.

Use only the context below:

Original Question:
${originalQuestion}

Previous AI Answer:
${previousAnswer}

Follow-up Type:
${followupType}

Instructions:
${getFollowupInstructions(followupType)}

Rules:
- Do not trigger or mention retrieval, sources, books, or search.
- Do not answer a different topic.
- Stay faithful to the original question and previous answer.
- Keep the response clear for a school student.
- Return only the follow-up answer text.
`.trim();

const extractGeneratedText = (result) => {
  const text = typeof result?.text === "function" ? result.text() : result?.text;
  return normalizeText(
    text || result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") || ""
  );
};

const toPictureCaption = (answer, originalQuestion) => {
  const cleaned = normalizeText(answer);
  if (cleaned) {
    const firstSentence = cleaned.match(/^(.{20,180}?[.!?])(\s|$)/)?.[1] || cleaned.slice(0, 180);
    return normalizeText(firstSentence);
  }

  const topic = summarizeLine(originalQuestion, 90);
  return `This image explains ${topic || "the topic"} in a simple visual way.`;
};

const summarizeLine = (value, maxLength = 80) => {
  const compact = normalizeText(value).replace(/\s+/g, " ");
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
};

const splitIntoSentences = (value) =>
  normalizeText(value)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildImagePrompt = ({ originalQuestion, previousAnswer }) => {
  const sentences = splitIntoSentences(previousAnswer).slice(0, 4);
  const keyPoints = sentences
    .map((point) => summarizeLine(point, 150))
    .filter(Boolean)
    .slice(0, 4)
    .map((point) => `- ${point}`)
    .join("\n");

  return [
    "Create a real educational classroom illustration for a school student.",
    "Use a clean, colorful, student-friendly visual style.",
    "Show the topic visually with meaningful objects, labels, arrows, and a clear learning layout.",
    "Do not include ASCII art, code, screenshots, or markdown text.",
    "",
    `Original question: ${summarizeLine(originalQuestion, 240)}`,
    "Important context from the previous answer:",
    keyPoints || `- ${summarizeLine(previousAnswer, 240)}`,
  ].join("\n");
};

const wrapText = (value, maxChars = 34, maxLines = 3) => {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;

  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = summarizeLine(clipped[maxLines - 1], maxChars);
  return clipped;
};

const renderTextLines = ({ text, x, y, maxChars = 34, maxLines = 3, fontSize = 18, weight = 500, fill = "#1f2937" }) =>
  wrapText(text, maxChars, maxLines)
    .map((line, index) => {
      const offset = index === 0 ? 0 : index * (fontSize + 7);
      return `<text x="${x}" y="${y + offset}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`;
    })
    .join("");

const buildFallbackPictureSvg = ({ originalQuestion, previousAnswer, caption }) => {
  const title = summarizeLine(originalQuestion.replace(/\?+$/, ""), 86) || "Picture Follow-up";
  const points = [
    caption,
    ...splitIntoSentences(previousAnswer).map((sentence) => summarizeLine(sentence, 95)),
    "Main idea from the previous answer",
    "Student-friendly visual summary",
  ].filter(Boolean).slice(0, 4);

  const cards = [
    { x: 70, y: 170, label: "Topic", text: points[0], fill: "#e0f2fe", stroke: "#0284c7" },
    { x: 560, y: 170, label: "Key Idea", text: points[1], fill: "#dcfce7", stroke: "#16a34a" },
    { x: 70, y: 405, label: "Details", text: points[2], fill: "#fef3c7", stroke: "#d97706" },
    { x: 560, y: 405, label: "Takeaway", text: points[3], fill: "#ede9fe", stroke: "#7c3aed" },
  ];

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="680" viewBox="0 0 1100 680">`,
    `<rect width="1100" height="680" rx="30" fill="#f8fafc"/>`,
    `<rect x="34" y="34" width="1032" height="612" rx="24" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>`,
    `<text x="550" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#1d4ed8">${escapeXml(title)}</text>`,
    `<text x="550" y="124" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" fill="#475569">${escapeXml(caption)}</text>`,
    `<circle cx="550" cy="338" r="74" fill="#eff6ff" stroke="#2563eb" stroke-width="4"/>`,
    `<text x="550" y="326" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#1e3a8a">Visual</text>`,
    `<text x="550" y="354" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1e3a8a">Summary</text>`,
  ];

  cards.forEach((card) => {
    parts.push(`<rect x="${card.x}" y="${card.y}" width="360" height="145" rx="18" fill="${card.fill}" stroke="${card.stroke}" stroke-width="2.5"/>`);
    parts.push(`<text x="${card.x + 180}" y="${card.y + 38}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">${escapeXml(card.label)}</text>`);
    parts.push(renderTextLines({ text: card.text, x: card.x + 180, y: card.y + 76 }));
  });

  [
    [430, 242, 486, 300],
    [670, 242, 614, 300],
    [430, 478, 486, 376],
    [670, 478, 614, 376],
  ].forEach(([x1, y1, x2, y2]) => {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/>`);
    parts.push(`<circle cx="${x2}" cy="${y2}" r="6" fill="#2563eb"/>`);
  });

  parts.push(`</svg>`);
  return parts.join("");
};

const writeGeneratedImage = async ({ originalQuestion, previousAnswer, bytes, extension }) => {
  const hash = crypto
    .createHash("sha1")
    .update(`${originalQuestion}\n${previousAnswer}\n${Date.now()}`)
    .digest("hex")
    .slice(0, 12);
  const filename = `picture-followup-${hash}.${extension}`;
  const filePath = path.join(FOLLOWUP_UPLOAD_DIR, filename);

  await writeFile(filePath, bytes);

  return `${FOLLOWUP_UPLOAD_URL}/${filename}`;
};

const createPictureImage = async ({ originalQuestion, previousAnswer, caption }) => {
  await mkdir(FOLLOWUP_UPLOAD_DIR, { recursive: true });

  const prompt = buildImagePrompt({ originalQuestion, previousAnswer, caption });
  if (ai) {
    try {
      const imageResult = await ai.models.generateImages({
        model: GEMINI_IMAGE_MODEL,
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "16:9",
          outputMimeType: "image/png",
          includeRaiReason: true,
        },
      });

      const generatedImage = imageResult?.generatedImages?.find((item) => item?.image?.imageBytes);
      const imageBytes = generatedImage?.image?.imageBytes;
      if (imageBytes) {
        return writeGeneratedImage({
          originalQuestion,
          previousAnswer,
          bytes: Buffer.from(imageBytes, "base64"),
          extension: "png",
        });
      }

      const raiReason =
        imageResult?.generatedImages?.find((item) => item?.raiFilteredReason)?.raiFilteredReason ||
        "No image bytes returned";
      console.warn("AI_FOLLOWUP_IMAGE_GENERATION_FALLBACK", raiReason);
    } catch (err) {
      console.warn("AI_FOLLOWUP_IMAGE_GENERATION_FALLBACK", err?.message || err);
    }
  } else {
    console.warn("AI_FOLLOWUP_IMAGE_GENERATION_FALLBACK", "AI client is not configured");
  }

  return writeGeneratedImage({
    originalQuestion,
    previousAnswer,
    bytes: buildFallbackPictureSvg({ originalQuestion, previousAnswer, caption }),
    extension: "svg",
  });
};

const getTopicText = (originalQuestion) => {
  const topic = normalizeText(originalQuestion)
    .replace(/^(explain|describe|what is|what are|who is|who was|write about|tell me about)\s+/i, "")
    .replace(/[?.!]+$/g, "");
  return summarizeLine(topic || originalQuestion, 90);
};

const getKeyPoints = (previousAnswer, count = 4) => {
  const points = splitIntoSentences(previousAnswer)
    .map((sentence) => summarizeLine(sentence, 150))
    .filter(Boolean);

  if (points.length) return points.slice(0, count);

  return [summarizeLine(previousAnswer, 150)].filter(Boolean);
};

const buildFallbackFollowupAnswer = ({ originalQuestion, previousAnswer, followupType }) => {
  const topic = getTopicText(originalQuestion);
  const points = getKeyPoints(previousAnswer, 4);
  const [firstPoint = "This is the main idea.", secondPoint = "It helps us understand the topic clearly."] = points;

  if (followupType === "architecture") {
    return [
      `${topic} - Structure`,
      "",
      `Main idea -> ${firstPoint}`,
      `Parts involved -> ${points.slice(1).join(" | ") || secondPoint}`,
      "Working flow -> Start with the basic idea -> connect the important parts -> understand the final result.",
      "",
      `In simple words, ${topic} can be understood by seeing how each part connects to the next part.`,
    ].join("\n");
  }

  if (followupType === "label_diagram") {
    return [
      `${topic} - Labeled Diagram Explanation`,
      "",
      `[Topic: ${topic}]`,
      "  |",
      `  |-> Label 1: Main idea - ${firstPoint}`,
      `  |-> Label 2: Important detail - ${secondPoint}`,
      `  |-> Label 3: Result - ${points[2] || "This helps us understand the topic better."}`,
      "",
      "Each label shows one important part and its function in the explanation.",
    ].join("\n");
  }

  if (followupType === "timeline") {
    return [
      `${topic} - Timeline`,
      "",
      `1. Start -> ${firstPoint}`,
      `2. Next -> ${secondPoint}`,
      `3. Then -> ${points[2] || "The idea becomes clearer through examples and details."}`,
      `4. Finally -> ${points[3] || "We understand the main lesson from the topic."}`,
      "",
      "This order shows how the idea develops step by step.",
    ].join("\n");
  }

  return [
    `${topic} - Simple Example`,
    "",
    firstPoint,
    "",
    `Example: Think of ${topic} like a simple classroom situation. First, you understand the main idea. Then you look at one real case where it happens. That makes the topic easier to remember.`,
    "",
    `So, in simple words: ${secondPoint}`,
  ].join("\n");
};

const buildFollowupResponse = ({ answer, followupType }) => ({
  answer,
  followupType,
  source: "ai-followup",
});

export const isValidFollowupType = (followupType) => VALID_FOLLOWUP_TYPES.has(followupType);

export async function generateAiFollowup({ originalQuestion, previousAnswer, followupType }) {
  const safeOriginalQuestion = normalizeText(originalQuestion);
  const safePreviousAnswer = normalizeText(previousAnswer);
  const safeFollowupType = normalizeText(followupType);

  if (!safeOriginalQuestion || !safePreviousAnswer) {
    const error = new Error("originalQuestion and previousAnswer are required");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidFollowupType(safeFollowupType)) {
    const error = new Error(`followupType must be one of: ${VALID_FOLLOWUP_TYPE_MESSAGE}`);
    error.statusCode = 400;
    throw error;
  }

  if (safeFollowupType === "picture") {
    const answer = toPictureCaption("", safeOriginalQuestion);
    const imageUrl = await createPictureImage({
      originalQuestion: safeOriginalQuestion,
      previousAnswer: safePreviousAnswer,
      caption: answer,
    });

    return {
      answer,
      followupType: safeFollowupType,
      source: "ai-followup",
      imageUrl,
    };
  }

  if (!ai) {
    return buildFollowupResponse({
      answer: buildFallbackFollowupAnswer({
        originalQuestion: safeOriginalQuestion,
        previousAnswer: safePreviousAnswer,
        followupType: safeFollowupType,
      }),
      followupType: safeFollowupType,
    });
  }

  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt({
        originalQuestion: safeOriginalQuestion,
        previousAnswer: safePreviousAnswer,
        followupType: safeFollowupType,
      }),
    });

    const answer = extractGeneratedText(result);
    if (answer) {
      return buildFollowupResponse({
        answer,
        followupType: safeFollowupType,
      });
    }
  } catch (err) {
    console.warn("AI_FOLLOWUP_TEXT_GENERATION_FALLBACK", err?.message || err);
  }

  return buildFollowupResponse({
    answer: buildFallbackFollowupAnswer({
      originalQuestion: safeOriginalQuestion,
      previousAnswer: safePreviousAnswer,
      followupType: safeFollowupType,
    }),
    followupType: safeFollowupType,
  });
}
