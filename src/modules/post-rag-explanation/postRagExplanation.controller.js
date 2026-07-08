import asyncHandler from "../../shared/asyncHandler.js";
import {
  generatePostRagExplanation,
  logPostRagExplanationError,
} from "./postRagExplanation.service.js";

export const explainPostRagAnswer = asyncHandler(async (req, res) => {
  res.type("text/plain");

  try {
    const explanation = await generatePostRagExplanation({
      originalQuestion: req.body?.originalQuestion,
      mode: req.body?.mode,
    });

    return res.send(explanation);
  } catch (err) {
    logPostRagExplanationError("POST_RAG_EXPLANATION_CONTROLLER_ERROR", err);
    const statusCode = err?.statusCode || 500;
    return res.status(statusCode).send(err?.message || "Unable to generate explanation.");
  }
});
