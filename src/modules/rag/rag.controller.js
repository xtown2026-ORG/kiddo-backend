import asyncHandler from "../../shared/asyncHandler.js";
import { GoogleGenAI } from "@google/genai";
import { routeRagQuestion } from "./subjectRouter.js";
import { solveImageQuestionWithGemini } from "./geminiSolver.js";
import {
  chunkText,
  textToSpeech,
} from "../../shared/services/voice.service.js";
import Class from "../classes/classes.model.js";
import AiChatLog from "../ai-chat-logs/ai-chat-log.model.js";

const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").replace(/^models\//, "");
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const LANGUAGE_MAP = [
  { canonical: "english", aliases: ["english"] },
  { canonical: "tamil", aliases: ["tamil"] },
  { canonical: "malayalam", aliases: ["malayalam", "malayam"] },
  { canonical: "kannada", aliases: ["kannada", "kanada"] },
  { canonical: "telugu", aliases: ["telugu"] },
  { canonical: "hindi", aliases: ["hindi"] },
  { canonical: "german", aliases: ["german"] },
  { canonical: "french", aliases: ["french", "franch"] },
  { canonical: "sanskrit", aliases: ["sanskrit", "sankrit"] },
];

const detectRequestedLanguage = (question) => {
  const q = String(question || "").toLowerCase();
  for (const lang of LANGUAGE_MAP) {
    if (lang.aliases.some((a) => q.includes(a))) {
      return lang.canonical;
    }
  }
  return null;
};

const extractLanguageFromQuestionText = (question) => {
  const q = String(question || "").toLowerCase();
  if (!q) return null;

  // Examples handled:
  // "what is homophone in tamil"
  // "explain this in malayalam"
  // "answer in hindi"
  for (const lang of LANGUAGE_MAP) {
    for (const alias of lang.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inPattern = new RegExp(`\\bin\\s+${escaped}\\b`, "i");
      const onlyPattern = new RegExp(`\\b${escaped}\\s+only\\b`, "i");
      if (inPattern.test(q) || onlyPattern.test(q)) {
        return lang.canonical;
      }
    }
  }

  return null;
};

const extractTaggedLanguage = (question) => {
  const q = String(question || "");
  const m = q.match(/\[\s*target_language\s*:\s*([a-zA-Z_ -]+)\s*\]/i);
  if (!m?.[1]) return null;
  return normalizeLanguage(m[1]);
};

const stripLanguageTag = (question) =>
  String(question || "")
    .replace(/\n?\s*\[\s*target_language\s*:\s*[a-zA-Z_ -]+\s*\]\s*/gi, " ")
    .trim();

const stripLanguageInstructionForSearch = (question) => {
  let normalized = String(question || "");

  for (const lang of LANGUAGE_MAP) {
    for (const alias of lang.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      normalized = normalized
        .replace(new RegExp(`\\bin\\s+${escaped}\\b`, "gi"), " ")
        .replace(new RegExp(`\\b${escaped}\\s+only\\b`, "gi"), " ")
        .replace(new RegExp(`\\banswer\\s+in\\s+${escaped}\\b`, "gi"), " ")
        .replace(new RegExp(`\\bexplain\\s+in\\s+${escaped}\\b`, "gi"), "explain ")
        .replace(new RegExp(`\\btranslate\\s+(?:this\\s+)?(?:to|into)\\s+${escaped}\\b`, "gi"), " ");
    }
  }

  return normalized.replace(/\s+/g, " ").trim();
};

const normalizeLanguage = (value) => {
  if (!value) return null;
  const lower = String(value).toLowerCase().trim();
  for (const lang of LANGUAGE_MAP) {
    if (lang.canonical === lower || lang.aliases.includes(lower)) {
      return lang.canonical;
    }
  }
  return null;
};

const LANGUAGE_CODES = {
  english: "en",
  tamil: "ta",
  malayalam: "ml",
  kannada: "kn",
  telugu: "te",
  hindi: "hi",
  german: "de",
  french: "fr",
  sanskrit: "sa",
};

const LANGUAGE_DISPLAY = {
  english: "English",
  tamil: "Tamil",
  malayalam: "Malayalam",
  kannada: "Kannada",
  telugu: "Telugu",
  hindi: "Hindi",
  german: "German",
  french: "French",
  sanskrit: "Sanskrit",
};

const applyNoStoreHeaders = (res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
};

const IMAGE_QUESTION_TEXT = "Uploaded image question";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const findUploadedImageFile = (req) => {
  const files = req.files;

  if (Array.isArray(files)) {
    return files.find((file) => file?.buffer);
  }

  return (
    req.file ||
    files?.image?.[0] ||
    files?.file?.[0] ||
    files?.questionImage?.[0] ||
    null
  );
};

const parseImageDataPayload = (body = {}) => {
  const rawImageData =
    body.image_data ||
    body.imageData ||
    body.photo_data ||
    body.photoData ||
    body.image_base64 ||
    body.imageBase64 ||
    body.questionImage ||
    body.image ||
    body.base64 ||
    body.data;

  if (!rawImageData) {
    return null;
  }

  console.log("IMAGE_BASE64_RECEIVED");

  const rawText = String(rawImageData).trim();
  const dataUrlMatch = rawText.match(IMAGE_DATA_URL_PATTERN);
  const mimeType =
    dataUrlMatch?.[1] || body.mime_type || body.mimeType || body.content_type || body.contentType;
  const imageBase64 = dataUrlMatch?.[2] || rawText;

  if (!ALLOWED_IMAGE_MIME_TYPES.has(String(mimeType || "").toLowerCase())) {
    return null;
  }

  const imageBuffer = Buffer.from(imageBase64, "base64");
  if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) {
    return null;
  }

  return {
    imageBase64: imageBuffer.toString("base64"),
    mimeType: String(mimeType).toLowerCase(),
  };
};

const sanitizeTamilOutput = (value) => {
  const text = String(value || "");
  if (!text) return text;

  return text
    // Remove private-use glyphs and replacement chars that often render as boxes.
    .replace(/[\uE000-\uF8FF\uFFFD]/g, "")
    // Remove zero-width / BOM artifacts from copied PDF text.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Remove visible square/box glyph symbols that appear in some Tamil outputs.
    .replace(/[□▢▣▤▥▦▧▨▩■◻◼◽◾]/g, "")
    // Keep visible line breaks tidy after cleanup.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const containsTamil = (value) => /[\u0B80-\u0BFF]/.test(String(value || ""));

const translateViaGtx = async (text, targetLanguage) => {
  const targetCode = LANGUAGE_CODES[targetLanguage];
  if (!targetCode) return text;

  const sourceText = String(text || "");

  // Try full-text translation first.
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetCode
    )}&dt=t&q=${encodeURIComponent(sourceText)}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part) => part?.[0] || "").join("")
        : "";
      if (translated?.trim()) return translated;
    }
  } catch {
    // Fall back to line-by-line translation below.
  }

  const lines = sourceText.split("\n");
  const out = [];

  for (const line of lines) {
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetCode
      )}&dt=t&q=${encodeURIComponent(line)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        out.push(line);
        continue;
      }
      const data = await resp.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part) => part?.[0] || "").join("")
        : "";
      out.push(translated || line);
    } catch {
      out.push(line);
    }
  }

  return out.join("\n");
};

const translateAnswer = async (text, targetLanguage) => {
  if (!text || !targetLanguage || targetLanguage === "english") {
    return text;
  }

  const languageHints = {
    tamil:
      "Output must be in Tamil only, using Tamil script only. Do not use Devanagari. Do not mix Hindi words.",
    malayalam:
      "Output must be in Malayalam only, using Malayalam script only.",
    kannada:
      "Output must be in Kannada only, using Kannada script only.",
    telugu:
      "Output must be in Telugu only, using Telugu script only.",
    hindi:
      "Output must be in Hindi only, using Devanagari script only.",
    sanskrit:
      "Output must be in Sanskrit only, using Devanagari script. Use formal Sanskrit vocabulary, not modern Hindi phrasing.",
    german:
      "Output must be in clear German suitable for school students.",
    french:
      "Output must be in clear French suitable for school students.",
  };

  const scriptRegex = {
    tamil: /[\u0B80-\u0BFF]/g,
    malayalam: /[\u0D00-\u0D7F]/g,
    kannada: /[\u0C80-\u0CFF]/g,
    telugu: /[\u0C00-\u0C7F]/g,
    hindi: /[\u0900-\u097F]/g,
    sanskrit: /[\u0900-\u097F]/g, // Devanagari
  };

  const isTranslationQualityGood = (candidate, original, lang) => {
    const output = String(candidate || "").trim();
    const source = String(original || "").trim();
    if (!output) return false;

    const unchanged = output.toLowerCase() === source.toLowerCase();
    if (unchanged) return false;

    if (scriptRegex[lang]) {
      const scriptCount = (output.match(scriptRegex[lang]) || []).length;
      const alphaCount = (output.match(/[A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0CFF\u0C80-\u0CFF\u0D00-\u0D7F]/g) || []).length;
      // Relaxed threshold: allow mixed technical terms but require visible target script.
      if (alphaCount > 20 && scriptCount < Math.max(6, Math.floor(alphaCount * 0.08))) {
        return false;
      }
    } else if (lang !== "english") {
      // For Latin-script target languages (German/French), reject clearly-English output.
      const englishHits = (output.toLowerCase().match(/\b(the|and|is|are|what|words|textbook|answer|clipped|formed)\b/g) || []).length;
      if (englishHits >= 4) return false;
    }

    return true;
  };

  const isLikelyWrongScript = (value, lang) => {
    const textValue = String(value || "");
    if (!scriptRegex[lang]) return false;
    const scriptChars = (textValue.match(scriptRegex[lang]) || []).length;
    const alphaChars = (textValue.match(/[A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0CFF\u0C80-\u0CFF\u0D00-\u0D7F]/g) || []).length;
    return alphaChars > 20 && scriptChars < Math.max(8, Math.floor(alphaChars * 0.2));
  };

  const hasTooMuchLatin = (value) => {
    const textValue = String(value || "");
    const latin = (textValue.match(/[A-Za-z]/g) || []).length;
    const allLetters = (textValue.match(/[A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0CFF\u0D00-\u0D7F]/g) || []).length;
    if (allLetters === 0) return false;
    return latin / allLetters > 0.35;
  };

  const isProbablyEnglish = (value) => {
    const txt = String(value || "").toLowerCase();
    const hits = (txt.match(/\b(the|and|is|are|what|words|textbook|answer|clipped|formed)\b/g) || []).length;
    return hits >= 4;
  };

  let finalText = text;
  let bestCandidate = "";
  if (ai) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const targetName = LANGUAGE_DISPLAY[targetLanguage] || targetLanguage;
      const prompt = [
        "You are a professional educational translator for K-12 textbook content.",
        `Task: Translate SOURCE_TEXT into ${targetName}.`,
        "",
        "Hard requirements (must follow all):",
        `1) Output language must be strictly ${targetName}.`,
        "2) Preserve original meaning exactly. Do not add, remove, or invent facts.",
        "3) Preserve structure exactly: headings, bullets, numbering, and line breaks.",
        "4) Translate full content. Do not leave full sentences in English.",
        "5) Keep proper nouns as-is if needed, but translate all common words.",
        "6) Return plain translated text only. No notes, no labels, no markdown fences, no code block.",
        "7) Keep numerals, punctuation, and list markers stable.",
        languageHints[targetLanguage] || "",
        attempt > 0
          ? "Previous output quality failed language/script checks. Regenerate with strict compliance."
          : "",
        "",
        "SOURCE_TEXT:",
        text,
      ]
        .filter(Boolean)
        .join("\n");

      let result = null;
      try {
        result = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
        });
      } catch (err) {
        // Continue to next attempt / fallback translator instead of returning English directly.
        continue;
      }

      const candidate =
        result?.text ||
        result?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
        "";
      const normalized = candidate.trim();
      if (!normalized) continue;
      finalText = normalized;
      if (
        normalized.toLowerCase() !== String(text).trim().toLowerCase() &&
        (!bestCandidate || normalized.length > bestCandidate.length)
      ) {
        bestCandidate = normalized;
      }

      const wrongScript =
        isLikelyWrongScript(finalText, targetLanguage) ||
        (scriptRegex[targetLanguage] && hasTooMuchLatin(finalText));
      const likelyEnglish =
        targetLanguage !== "english" &&
        !scriptRegex[targetLanguage] &&
        isProbablyEnglish(finalText);

      if (!wrongScript && !likelyEnglish && isTranslationQualityGood(finalText, text, targetLanguage)) {
        break;
      }
    }
  }

  const stillBad =
    !isTranslationQualityGood(finalText, text, targetLanguage);

  if (stillBad) {
    const gtx = await translateViaGtx(text, targetLanguage);
    if (gtx && gtx.trim() && isTranslationQualityGood(gtx, text, targetLanguage)) {
      finalText = gtx;
    } else if (gtx && gtx.trim() && gtx.trim().toLowerCase() !== String(text).trim().toLowerCase()) {
      // Accept changed fallback even if strict validator is unsure.
      finalText = gtx.trim();
    }
  }

  if (!finalText || finalText.trim().toLowerCase() === String(text).trim().toLowerCase()) {
    if (bestCandidate) return bestCandidate;
  }

  if (targetLanguage === "tamil") {
    return sanitizeTamilOutput(finalText || text);
  }

  return finalText || text;
};

const normalizeClassLevel = (value) => {
  if (!value) return value;
  const str = String(value).trim().toLowerCase();
  const digitMatch = str.match(/\d+/);
  if (digitMatch) return digitMatch[0];
  return str.replace(/^class\s*/, "");
};

const normalizeFollowUpComparable = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const FOLLOW_UP_REFERENCE_PATTERN =
  /\b(this|that|it|they|them|these|those|above|previous|earlier|same|more|detail|brief|short|summary|meaning|mean|continue|again|he|she|his|her|their|its|him)\b/i;
const FOLLOW_UP_DIRECT_PATTERN =
  /^(?:in\s+detail|in\s+short|briefly|shortly|more\s+detail|more\s+details|explain\s+more|tell\s+me\s+more|continue|elaborate|what\s+about\s+(?:this|that|it)|what\s+does\s+(?:this|that|it)\s+mean)\b/i;
const FOLLOW_UP_FACT_PATTERN =
  /\b(how\s+many|how\s+much|how\s+long|how\s+old|which\s+year|what\s+year|whose|whom|where|when|who|meaning|mean|meant|duration|birthplace|born|capital|lasted\s+from)\b/i;

const isLikelyFollowUpQuestion = (question) => {
  const normalized = normalizeFollowUpComparable(question);
  if (!normalized) return false;

  const words = normalized.split(/\s+/).filter(Boolean);

  if (FOLLOW_UP_DIRECT_PATTERN.test(normalized)) {
    return true;
  }

  if (words.length <= 6 && FOLLOW_UP_REFERENCE_PATTERN.test(normalized)) {
    return true;
  }

  if (
    words.length <= 8 &&
    /^(why|how|when|where|who)\b/.test(normalized) &&
    /\b(this|that|it|they|these|those|he|she|his|her|their|its|him)\b/.test(normalized)
  ) {
    return true;
  }

  if (
    words.length <= 8 &&
    /\?$/.test(String(question || "").trim()) &&
    !/\b(?:about|explain|describe|write|note|detail|brief|short)\b/.test(normalized)
  ) {
    return true;
  }

  if (
    words.length <= 16 &&
    FOLLOW_UP_FACT_PATTERN.test(normalized) &&
    !/^\b(?:what\s+is|what\s+are|define|describe|explain|write\s+about|tell\s+me\s+about)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
};

const buildFollowUpAwareQuestion = ({ question, previousQuestion }) => {
  const current = String(question || "").trim();
  const previous = String(previousQuestion || "").trim();

  if (!current || !previous) {
    return current;
  }

  const normalized = normalizeFollowUpComparable(current);

  if (
    /^(?:in\s+detail|in\s+short|briefly|shortly|more\s+detail|more\s+details|explain\s+more|tell\s+me\s+more|continue|elaborate)$/i.test(
      normalized
    )
  ) {
    return `${previous} ${current}`;
  }

  return `${current} in the context of ${previous}`;
};

const getPreviousRagChatLog = async (userId) => {
  if (!userId) return null;

  return AiChatLog.findOne({
    where: { user_id: userId, ai_type: "rag" },
    order: [["created_at", "DESC"]],
  });
};

const saveRagChatLog = async ({
  userId,
  question,
  answer,
  classLevel,
  modelUsed = "rag",
  tokensUsed = 0,
}) => {
  if (!userId || !question || !answer) return;

  try {
    await AiChatLog.create({
      user_id: userId,
      user_query: String(question).trim(),
      ai_response: String(answer).trim(),
      tokens_used: Number(tokensUsed) || 0,
      model_used: modelUsed,
      ai_type: "rag",
      class_level: classLevel || null,
    });
  } catch (err) {
    console.error("Failed to save RAG chat log:", err?.message || err);
  }
};

export const askQuestion = asyncHandler(async (req, res) => {
  applyNoStoreHeaders(res);

  const payload = req.method === "GET" ? req.query : req.body;
  const {
    question,
    classLevel,
    language,
    preferredLanguage,
    lang,
    sourcePath,
    source_path,
    bookPath,
    book_path,
    pdfPath,
    pdf_path,
    currentBook,
    current_book,
    selectedBook,
    selected_book,
    book,
    chapter,
  } = payload;
  const voiceEnabled = req.query.voice === "true";
  const headerLanguage = req.headers["x-chat-language"];
  const queryLanguage = req.query.lang;

  const uploadedFile = findUploadedImageFile(req);
  if (uploadedFile) {
    console.log("IMAGE_FILE_RECEIVED");
  }

  const imageInput = uploadedFile
    ? {
        imageBase64: uploadedFile.buffer.toString("base64"),
        mimeType: uploadedFile.normalizedMimeType || uploadedFile.mimetype,
      }
    : parseImageDataPayload(payload);
  const cleanedQuestion = question ? stripLanguageTag(question) : "";

  if (imageInput) {
    try {
      const answer = await solveImageQuestionWithGemini({
        ...imageInput,
        question: cleanedQuestion,
      });

      return res.json({
        question: cleanedQuestion || IMAGE_QUESTION_TEXT,
        answer: answer || "I could not generate an answer from the image right now.",
        sources: [],
        source_type: "gemini",
        filters_used: "image_gemini_solver",
      });
    } catch (err) {
      console.error("IMAGE_QUESTION_SOLVER_ERROR", err?.message || err);
      return res.status(500).json({
        message: "I could not solve the uploaded image right now. Please try again in a moment.",
      });
    }
  }

  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  const taggedLanguage = extractTaggedLanguage(question);
  let searchQuestion = stripLanguageInstructionForSearch(cleanedQuestion);
  const scopedBook =
    sourcePath ||
    source_path ||
    bookPath ||
    book_path ||
    pdfPath ||
    pdf_path ||
    currentBook ||
    current_book ||
    selectedBook ||
    selected_book ||
    (book ? { book, chapter } : chapter ? { chapter } : null);
  let effectiveClassLevel = normalizeClassLevel(classLevel);

  if (req.user?.role === "student" && req.user?.class_id) {
    const cls = await Class.findOne({
      where: { id: req.user.class_id, school_id: req.user.school_id },
      attributes: ["class_name"],
    });
    if (cls?.class_name) {
      effectiveClassLevel = normalizeClassLevel(cls.class_name);
    }
  }

  const previousRagLog =
    req.user?.id && isLikelyFollowUpQuestion(searchQuestion || cleanedQuestion)
      ? await getPreviousRagChatLog(req.user.id)
      : null;
  const preferPreciseAnswer = Boolean(previousRagLog);

  if (previousRagLog?.user_query) {
    searchQuestion = buildFollowUpAwareQuestion({
      question: searchQuestion || cleanedQuestion,
      previousQuestion: previousRagLog.user_query,
    });
  }

  let result;
  try {
    result = await routeRagQuestion({
      question: searchQuestion || cleanedQuestion,
      originalQuestion: cleanedQuestion,
      preferPreciseAnswer,
      previousAnswer: previousRagLog?.ai_response || null,
      classLevel: effectiveClassLevel,
      bookScope: scopedBook,
      userId: req.user.id,
    });
  } catch (err) {
    console.error("RAG ask failed:", err?.message || err);
    result = {
      answer:
        "I could not generate an answer right now. Please try again in a moment.",
      sources: [],
      source_type: "fallback",
    };
  }

  // 🔹 TEXT-ONLY (default)
  if (!voiceEnabled) {
    const inlineQuestionLanguage = extractLanguageFromQuestionText(cleanedQuestion);
    const requestedLanguage =
      inlineQuestionLanguage ||
      taggedLanguage ||
      normalizeLanguage(language) ||
      normalizeLanguage(preferredLanguage) ||
      normalizeLanguage(lang) ||
      normalizeLanguage(headerLanguage) ||
      normalizeLanguage(queryLanguage) ||
      detectRequestedLanguage(cleanedQuestion);
    let textAnswer = result.answer;

    if (requestedLanguage) {
      try {
        textAnswer = await translateAnswer(result.answer, requestedLanguage);
      } catch (err) {
        console.error("Text translation failed:", err?.message || err);
      }
    }

    if (!requestedLanguage && (containsTamil(cleanedQuestion) || containsTamil(textAnswer))) {
      textAnswer = sanitizeTamilOutput(textAnswer);
    }

    await saveRagChatLog({
      userId: req.user?.id,
      question: cleanedQuestion,
      answer: textAnswer,
      classLevel: effectiveClassLevel,
      tokensUsed: result?.tokens_used || 0,
    });

    return res.json({
      question: cleanedQuestion,
      answer: textAnswer,
      sources: result.sources,
      ...(result.billing_warning ? { billing_warning: result.billing_warning } : {}),
    });
  }

  // 🔹 VOICE MODE
  const sentences = chunkText(result.answer);

// send subtitle text for frontend
res.setHeader("x-subtitle-text", encodeURIComponent(result.answer));

res.setHeader("Content-Type", "audio/wav");
res.setHeader("Transfer-Encoding", "chunked");

for (const sentence of sentences) {
  try {
    const wavBuffer = await textToSpeech(sentence);
    res.write(wavBuffer);
  } catch (err) {
    console.error("TTS failed:", err.message);
    break;
  }
}

await saveRagChatLog({
  userId: req.user?.id,
  question: cleanedQuestion,
  answer: result.answer,
  classLevel: effectiveClassLevel,
  tokensUsed: result?.tokens_used || 0,
});

res.end();
});

export const speakText = asyncHandler(async (req, res) => {
  applyNoStoreHeaders(res);

  const { text } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).json({ message: "Text is required" });
  }

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Transfer-Encoding", "chunked");

  const sentences = chunkText(String(text));

  for (const sentence of sentences) {
    try {
      const wavBuffer = await textToSpeech(sentence);
      res.write(wavBuffer);
    } catch (err) {
      console.error("TTS failed:", err.message);
      break;
    }
  }

  res.end();
});

export const askImageQuestion = asyncHandler(async (req, res) => {
  applyNoStoreHeaders(res);

  try {
    const uploadedFile = findUploadedImageFile(req);
    const imageInput = uploadedFile
      ? {
          imageBase64: uploadedFile.buffer.toString("base64"),
          mimeType: uploadedFile.normalizedMimeType || uploadedFile.mimetype,
        }
      : parseImageDataPayload(req.body);

    if (!imageInput) {
      return res.status(400).json({ message: "Image is required" });
    }

    if (uploadedFile) {
      console.log("IMAGE_FILE_RECEIVED");
    }

    const answer = await solveImageQuestionWithGemini({
      ...imageInput,
      question: req.body?.question || req.body?.text || req.body?.message,
    });

    return res.json({
      question: req.body?.question || IMAGE_QUESTION_TEXT,
      answer: answer || "I could not generate an answer from the image right now.",
      sources: [],
      source_type: "gemini",
      filters_used: "image_gemini_solver",
    });
  } catch (err) {
    console.error("IMAGE_QUESTION_SOLVER_ERROR", err?.message || err);
    return res.status(500).json({
      message: "I could not solve the uploaded image right now. Please try again in a moment.",
    });
  }
});
