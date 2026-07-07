import asyncHandler from "../../shared/asyncHandler.js";
import { relatedQuestionService } from "./relatedQuestion.service.js";

export const getRelatedQuestions = asyncHandler(async (req, res) => {
  const questions = await relatedQuestionService.generate(req.body?.question);
  res.json({ questions });
});
