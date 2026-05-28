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
  "gemini-3-pro-image-preview"
).replace(/^models\//, "");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const normalizeText = (value) =>
  String(value || "").trim();

const FOLLOWUP_SUGGESTION_CONFIG = [
  {
    label: "Explain with Example",
    followupType: "example",
  },
  {
    label: "Step by Step",
    followupType: "step_by_step",
  },
  {
    label: "Explain Picture",
    followupType: "picture",
  },
  {
    label: "Short Summary",
    followupType: "short_summary",
  },
];

const getTopicText = (question) =>
  normalizeText(question)
    .replace(
      /^(what is|what are|explain|describe)\s+/i,
      ""
    )
    .replace(/[?.!]+$/g, "");

const isBiologyTopic = (topic = "") =>
  /\b(biology|cell|tissue|organ|organism|plant|animal|human body|digestive|respiratory|circulatory|nervous system|photosynthesis|reproduction|genetics|dna|rna|chromosome|bacteria|virus|fungi|protozoa|ecosystem|food chain|taxonomy|phylum|chordata|hemichordata|prokaryotic|eukaryotic|membrane|mitochondria|nucleus)\b/i.test(
    normalizeText(topic)
  );

const buildEducationalImagePrompt = (topic) => {
  if (isBiologyTopic(topic)) {
    return `
Create a professional textbook-quality educational biology infographic poster on "${topic}".

Design requirements:
- Ultra clean scientific illustration
- White background
- High-resolution educational poster
- Accurate biological structures
- Professional textbook layout
- Student-friendly infographic design
- Balanced spacing and alignment
- Properly aligned labels
- Thin annotation arrows
- Modern educational color palette
- Soft scientific colors
- Crisp vector-style illustration
- Sharp readable text
- No spelling mistakes
- No distorted text
- No overlapping labels
- High-detail scientific drawing
- Professional biology atlas style
- Exam preparation format
- Printable academic poster
- Clean section borders
- Symmetrical composition
- Consistent typography
- Educational publishing quality

Include:
1. Main labeled diagram
2. Identify and label section
3. Key features box
4. Short-answer questions section
5. Quick comparison table if applicable

Label style:
- Straight annotation lines
- Proper spacing between labels
- Horizontal readable text
- Scientific naming format
- Consistent font size

Output style:
- Biology textbook infographic
- Scientific educational chart
- CBSE/NEET exam style poster
- Professional academic illustration
- Museum-quality biology artwork

Quality rules:
- Ultra HD
- 4K quality
- Sharp outlines
- Clean vector finish
- Accurate anatomy
- High readability
- Print-ready poster
- Professional infographic composition

Negative instructions:
- No blurry text
- No distorted labels
- No overlapping annotations
- No messy layout
- No low-quality rendering
- No extra unnecessary objects
- No dark background
- No cartoon style
- No watermark
- No cropped labels
`;
  }

  return `
High quality educational textbook diagram of ${topic}, labeled structure, arrows, white background, clean scientific illustration, student friendly, highly detailed, educational poster style, biology textbook quality, 4k.

IMPORTANT:
- Use REALISTIC educational visuals
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
};

const buildPictureFallbackAnswer = ({
  originalQuestion,
  previousAnswer,
}) => `
Visual Explanation:
Picture this like a clean textbook diagram of ${getTopicText(
  originalQuestion
)} on a white background.

- Put the main title at the top.
- Place the central structure in the middle.
- Add clear labels on the sides with straight arrows pointing to each part.
- Keep related parts grouped neatly.
- Show the flow or function in the correct order from left to right or top to bottom.
- Highlight the most important terms students should remember.

Text Explanation:
${previousAnswer}
`.trim();

const PREVIEW_IMAGE_MODELS = [
  GEMINI_IMAGE_PREVIEW_MODEL,
  "gemini-3-pro-image-preview",
].filter(Boolean);

const IMAGE_GENERATION_MODELS = [
  GEMINI_IMAGE_MODEL,
  "imagen-4.0-fast-generate-001",
].filter(Boolean);

const getBase64ImageFromInteraction = (
  interaction
) => {
  const outputs = Array.isArray(
    interaction?.outputs
  )
    ? interaction.outputs
    : [];

  for (const output of outputs) {
    if (output?.type !== "image") {
      continue;
    }

    if (output?.data) {
      return output.data;
    }

    if (
      output?.inlineData?.data
    ) {
      return output.inlineData.data;
    }

    if (
      output?.image?.imageBytes
    ) {
      return output.image.imageBytes;
    }
  }

  return "";
};

const getBase64ImageFromGeneratedImages =
  (response) => {
    const generatedImages =
      Array.isArray(
        response?.generatedImages
      )
        ? response.generatedImages
        : [];

    for (const generatedImage of generatedImages) {
      if (
        generatedImage?.image?.imageBytes
      ) {
        return generatedImage.image
          .imageBytes;
      }

      if (
        generatedImage?.imageBytes
      ) {
        return generatedImage.imageBytes;
      }
    }

    return "";
  };

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

    const prompt =
      buildEducationalImagePrompt(
        topic
      );

    for (const model of PREVIEW_IMAGE_MODELS) {
      try {
        console.log(
          "START_IMAGE_GENERATION_INTERACTION",
          model
        );

        const interaction =
          await ai.interactions.create({
            model,
            input: prompt,
            response_modalities: [
              "image",
            ],
          });

        const imageData =
          getBase64ImageFromInteraction(
            interaction
          );

        if (!imageData) {
          throw new Error(
            "No image data returned from Gemini interaction"
          );
        }

        console.log(
          "IMAGE_INTERACTION_RESPONSE_SUCCESS",
          model
        );

        return await writeGeneratedImage({
          originalQuestion,
          previousAnswer,
          bytes: Buffer.from(
            imageData,
            "base64"
          ),
        });
      } catch (err) {
        console.error(
          "IMAGE_INTERACTION_ERROR:",
          model,
          err?.message || err
        );
      }
    }

    for (const model of IMAGE_GENERATION_MODELS) {
      try {
        console.log(
          "START_IMAGE_GENERATION_MODEL",
          model
        );

        const response =
          await ai.models.generateImages({
            model,
            prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: "16:9",
            },
          });

        console.log(
          "IMAGE_MODEL_RESPONSE_SUCCESS",
          model
        );

        const image =
          getBase64ImageFromGeneratedImages(
            response
          );

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
          model,
          err?.message || err
        );
      }
    }

    return {
      failed: true,
    };
  };

const generateTextAnswer =
  async ({
    originalQuestion,
    previousAnswer,
    followupType,
  }) => {
    const followupInstructionByType = {
      example: `Continue the same topic naturally and explain it with 1 or 2 simple real-life examples.`,
      step_by_step: `Continue the same topic naturally and explain it slowly in numbered points.`,
      short_summary: `Continue the same topic naturally and give a very short revision note in 2 or 3 lines.`,
    };

    const followupInstruction =
      followupInstructionByType[
        followupType
      ] ||
      "Continue the same topic naturally and explain it clearly in a short, student-friendly way.";

    try {
      const result =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `
You are a professional educational AI assistant.

Behavior rules:
- First answer the student's question normally and clearly.
- Do not disturb the normal chat flow.
- Do not automatically continue into long explanations.
- Keep the response short, clean, educational, and student friendly.
- Continue the SAME topic naturally using the previous context.
- Do not ask the student to repeat the question.
- Never say "I don't understand", "No context", "Unable to generate", or "Please provide more details".

Question:
${originalQuestion}

Previous Answer:
${previousAnswer}

Followup Type:
${followupType}

Instruction:
${followupInstruction}

Generate only the answer text for students. Do not add suggestion labels or extra sections.
`,
        });

      return (
        result?.text ||
        "Let's continue with a short, clear explanation."
      );
    } catch (err) {
      console.error(
        "TEXT_GENERATION_ERROR:",
        err?.message || err
      );

      return "Let's continue with a short, clear explanation.";
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

    return FOLLOWUP_SUGGESTION_CONFIG.map(
      (item) => ({
        ...item,
        topic: getTopicText(
          safeQuestion
        ),
      })
    );
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
          buildPictureFallbackAnswer({
            originalQuestion:
              safeQuestion,
            previousAnswer:
              safeAnswer,
          }),
        followupType:
          safeType,
        source: "ai-followup",
        followupSuggestions:
          buildStudentFollowupSuggestions({
            originalQuestion:
              safeQuestion,
            previousAnswer:
              safeAnswer,
          }),
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
      followupSuggestions:
        buildStudentFollowupSuggestions({
          originalQuestion:
            safeQuestion,
          previousAnswer:
            safeAnswer,
        }),
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
    followupSuggestions:
      buildStudentFollowupSuggestions({
        originalQuestion:
          safeQuestion,
        previousAnswer:
          safeAnswer,
      }),
  };
}
