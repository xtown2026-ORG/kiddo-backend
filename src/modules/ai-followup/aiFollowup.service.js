import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import fs from "fs";
import path from "path";

loadEnv();

<<<<<<< HEAD
const MODULE_DIR = path.dirname(
  fileURLToPath(import.meta.url)
);
=======
const VALID_FOLLOWUP_TYPES = new Set(["picture", "architecture", "example", "label_diagram", "timeline"]);
const VALID_FOLLOWUP_TYPE_MESSAGE = "picture, architecture, example, label_diagram, timeline";
export const FOLLOWUP_UPLOAD_DIR = path.join(process.cwd(), "uploads", "ai-followups");
const GEMINI_MODEL = (process.env.GEMINI_FOLLOWUP_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").replace(
  /^models\//,
  ""
);
const IMAGEN_MODEL = (process.env.IMAGEN_MODEL || "imagen-4.0-generate-001").replace(/^models\//, "");
const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3003}`).replace(/\/$/, "");
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
>>>>>>> 28bcb484 (pwa)

const PROJECT_ROOT = path.resolve(
  MODULE_DIR,
  "../../../"
);

export const FOLLOWUP_UPLOAD_DIR = path.join(
  PROJECT_ROOT,
  "uploads",
  "ai-followups"
);

const FOLLOWUP_UPLOAD_URL =
  "/api/ai-followup/uploads/ai-followups";

const GEMINI_IMAGE_MODEL = (
  process.env.GEMINI_IMAGE_MODEL ||
  "imagen-4.0-fast-generate-001"
).replace(/^models\//, "");

const GEMINI_IMAGE_PREVIEW_MODEL = (
  process.env.GEMINI_IMAGE_PREVIEW_MODEL ||
  "gemini-3.1-flash-image-preview"
).replace(/^models\//, "");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const normalizeText = (value) =>
  String(value || "").trim();

const getTopicText = (question) =>
  normalizeText(question)
    .replace(
      /^(what is|what are|explain|describe)\s+/i,
      ""
    )
    .replace(/[?.!]+$/g, "");

const toImageDataUrl = (bytes) => {
  return `data:image/png;base64,${Buffer.from(
    bytes
  ).toString("base64")}`;
};

const writeGeneratedImage = async ({
  originalQuestion,
  previousAnswer,
  bytes,
}) => {
  const version = Date.now();

<<<<<<< HEAD
=======
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

const buildImagePrompt = ({ originalQuestion, previousAnswer }) => {
  const sentences = splitIntoSentences(previousAnswer).slice(0, 4);
  const keyPoints = sentences
    .map((point) => summarizeLine(point, 150))
    .filter(Boolean)
    .slice(0, 4)
    .map((point) => `- ${point}`)
    .join("\n");

  const topic = getTopicText(originalQuestion);

  return [
    `${topic} educational diagram for students`,
    "Create a simple, clean, colorful educational diagram or chart.",
    "Use clear labels, arrows, visual grouping, and classroom-friendly illustration style.",
    "Make the image directly match the same follow-up topic.",
    "Do not create photorealistic people. Do not create screenshots. Do not include code or markdown.",
    "",
    `Topic: ${summarizeLine(originalQuestion, 180)}`,
    "Key ideas to include:",
    keyPoints || `- ${summarizeLine(previousAnswer, 180)}`,
  ].join("\n");
};

const writeGeneratedImage = async ({ originalQuestion, previousAnswer, bytes, extension }) => {
>>>>>>> 28bcb484 (pwa)
  const hash = crypto
    .createHash("sha1")
    .update(
      `${originalQuestion}\n${previousAnswer}\n${version}`
    )
    .digest("hex")
    .slice(0, 12);

  const filename = `picture-followup-${hash}.png`;

  const filePath = path.join(
    FOLLOWUP_UPLOAD_DIR,
    filename
  );

  fs.writeFileSync(filePath, bytes);

<<<<<<< HEAD
  return {
    imageUrl: `${FOLLOWUP_UPLOAD_URL}/${filename}?v=${version}`,
    imageDataUrl:
      toImageDataUrl(bytes),
  };
};

const generateEducationalImage =
  async ({
    originalQuestion,
    previousAnswer,
  }) => {
    await mkdir(
      FOLLOWUP_UPLOAD_DIR,
      {
        recursive: true,
      }
    );

    const topic =
      getTopicText(originalQuestion);
=======
  return `${BASE_URL}/uploads/ai-followups/${filename}`;
};

const extractGeneratedImageBytes = (imageResult) => {
  const generatedImage = imageResult?.generatedImages?.find((item) => item?.image?.imageBytes);
  return generatedImage?.image?.imageBytes || "";
};

const generateImagenFollowupImage = async ({ originalQuestion, previousAnswer }) => {
  if (!ai) {
    throw new Error("Imagen follow-up generation failed: GEMINI_API_KEY is not configured");
  }

  fs.mkdirSync(FOLLOWUP_UPLOAD_DIR, { recursive: true });

  const prompt = buildImagePrompt({ originalQuestion, previousAnswer });
  const imageResult = await ai.models.generateImages({
    model: IMAGEN_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9",
      outputMimeType: "image/png",
      includeRaiReason: true,
    },
  });

  const imageBytes = extractGeneratedImageBytes(imageResult);
  if (!imageBytes) {
    const raiReason =
      imageResult?.generatedImages?.find((item) => item?.raiFilteredReason)?.raiFilteredReason ||
      "No image bytes returned by Imagen";
    throw new Error(`Imagen follow-up generation failed: ${raiReason}`);
  }

  return writeGeneratedImage({
    originalQuestion,
    previousAnswer,
    bytes: Buffer.from(imageBytes, "base64"),
    extension: "png",
  });
};

const createPictureImage = async ({ originalQuestion, previousAnswer }) => {
  try {
    return await generateImagenFollowupImage({ originalQuestion, previousAnswer });
  } catch (err) {
    console.error("AI_FOLLOWUP_IMAGEN_ERROR", err);
    return null;
  }
};

const getTopicText = (originalQuestion) => {
  const topic = normalizeText(originalQuestion)
    .replace(/^(explain|describe|what is|what are|who is|who was|write about|tell me about)\s+/i, "")
    .replace(/[?.!]+$/g, "");
  return summarizeLine(topic || originalQuestion, 90);
};
>>>>>>> 28bcb484 (pwa)

    const prompt = `
Create a realistic educational textbook infographic for "${topic}".

IMPORTANT:
- Use REALISTIC educational visuals
- Use REAL animal and nature images
- Use science textbook infographic style
- White background
- Educational arrows
- Minimal text
- Student-friendly
- Professional educational design
- Landscape layout

STRICTLY AVOID:
- SVG style
- Text boxes
- UI cards
- Flowchart blocks
- Summary cards
- Mind maps
- Concept diagrams

If topic is food chain:
show realistic:
- grass
- grasshopper
- frog
- snake
- eagle
- fungi and earthworms

Make it look like a real school science textbook infographic.
`;

    try {
      console.log(
        "START_IMAGE_GENERATION_INTERACTION"
      );

      const interaction =
        await ai.interactions.create({
          model:
            GEMINI_IMAGE_PREVIEW_MODEL,
          input: prompt,
          response_modalities: [
            "image",
          ],
        });

      const imageOutput =
        interaction?.outputs?.find(
          (output) =>
            output?.type === "image" &&
            output?.data
        );

      if (!imageOutput?.data) {
        throw new Error(
          "No image data returned from Gemini interaction"
        );
      }

      console.log(
        "IMAGE_INTERACTION_RESPONSE_SUCCESS"
      );

      return await writeGeneratedImage({
        originalQuestion,
        previousAnswer,
        bytes: Buffer.from(
          imageOutput.data,
          "base64"
        ),
      });
    } catch (err) {
      console.error(
        "IMAGE_INTERACTION_ERROR:",
        err?.message || err
      );
    }

    try {
      console.log(
        "START_IMAGE_GENERATION_MODEL"
      );

      const response =
        await ai.models.generateImages({
          model:
            GEMINI_IMAGE_MODEL,
          prompt,
          config: {
            numberOfImages: 1,
            aspectRatio: "16:9",
          },
        });

      console.log(
        "IMAGE_MODEL_RESPONSE_SUCCESS"
      );

      const image =
        response?.generatedImages?.[0]
          ?.image?.imageBytes;

      if (!image) {
        throw new Error(
          "No image bytes returned"
        );
      }

      return await writeGeneratedImage({
        originalQuestion,
        previousAnswer,
        bytes: Buffer.from(
          image,
          "base64"
        ),
      });
    } catch (err) {
      console.error(
        "IMAGE_MODEL_ERROR:",
        err?.message || err
      );

      return {
        failed: true,
      };
    }
  };

const generateTextAnswer =
  async ({
    originalQuestion,
    previousAnswer,
    followupType,
  }) => {
    try {
      const result =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `
You are a professional educational AI assistant.

Question:
${originalQuestion}

Previous Answer:
${previousAnswer}

Followup Type:
${followupType}

Generate a clean educational response for students.
`,
        });

      return (
        result?.text ||
        "Unable to generate answer."
      );
    } catch (err) {
      console.error(
        "TEXT_GENERATION_ERROR:",
        err?.message || err
      );

      return "Unable to generate answer.";
    }
  };

export const buildStudentFollowupSuggestions =
  ({
    originalQuestion,
    previousAnswer,
  }) => {
    const safeQuestion =
      normalizeText(originalQuestion);
    const safeAnswer =
      normalizeText(previousAnswer);

    if (!safeQuestion || !safeAnswer) {
      return [];
    }

    return [
      {
        label: "Explain with Example",
        followupType: "example",
        topic: getTopicText(
          safeQuestion
        ),
      },
      {
        label: "Explain Step by Step",
        followupType:
          "step_by_step",
        topic: getTopicText(
          safeQuestion
        ),
      },
      {
        label: "Explain Details",
        followupType: "details",
        topic: getTopicText(
          safeQuestion
        ),
      },
      {
        label: "Explain Picture",
        followupType: "picture",
        topic: getTopicText(
          safeQuestion
        ),
      },
    ];
  };

export async function generateAiFollowup({
  originalQuestion,
  previousAnswer,
  followupType,
}) {
  const safeQuestion =
    normalizeText(originalQuestion);

  const safeAnswer =
    normalizeText(previousAnswer);

  const safeType =
    normalizeText(
      followupType
    ).toLowerCase();

  if (
    !safeQuestion ||
    !safeAnswer
  ) {
    throw new Error(
      "Question and previous answer required"
    );
  }

  if (safeType === "picture") {
    const imageResult =
      await generateEducationalImage({
        originalQuestion:
          safeQuestion,
        previousAnswer:
          safeAnswer,
      });

<<<<<<< HEAD
    if (imageResult.failed) {
      return {
        answer:
          "Unable to generate educational image right now. Please try again.",
        followupType:
          safeType,
        source: "ai-followup",
      };
    }

    return {
      answer: `This image explains ${getTopicText(
        safeQuestion
      )} in a simple visual way.`,
      followupType:
        safeType,
=======
  if (safeFollowupType === "picture") {
    const answer = toPictureCaption("", safeOriginalQuestion);
    const imageUrl = await createPictureImage({
      originalQuestion: safeOriginalQuestion,
      previousAnswer: safePreviousAnswer,
    });

    return {
      type: "image",
      answer,
      followupType: safeFollowupType,
>>>>>>> 28bcb484 (pwa)
      source: "ai-followup",
      imageUrl:
        imageResult.imageUrl,
      imageDataUrl:
        imageResult.imageDataUrl,
    };
  }

  const answer =
    await generateTextAnswer({
      originalQuestion:
        safeQuestion,
      previousAnswer:
        safeAnswer,
      followupType:
        safeType,
    });

  return {
    answer,
    followupType:
      safeType,
    source: "ai-followup",
  };
}
