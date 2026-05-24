import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

loadEnv();

const MODULE_DIR = path.dirname(
  fileURLToPath(import.meta.url)
);

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

  await writeFile(filePath, bytes);

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
