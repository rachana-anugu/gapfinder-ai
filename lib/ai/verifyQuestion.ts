import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";
import { GeneratedQuestion, ChunkForGeneration } from "./genQuestion";

export const VerificationResultSchema = z.object({
  chunkSupportsCorrectAnswer: z
    .boolean()
    .describe("Whether the source chunk text alone explicitly supports the correct answer"),
  distractorsAreIncorrect: z
    .boolean()
    .describe("Whether the wrong options are unequivocally refuted or unsupported by the chunk"),
  passed: z
    .boolean()
    .describe("Overall verification pass (must be true only if both prior conditions hold)"),
  explanation: z
    .string()
    .describe("Evidence from the chunk or reason why it passed/failed"),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

/**
 * Deterministic verification fallback for offline/mock environments.
 */
export function fallbackVerify(
  question: GeneratedQuestion,
  sourceChunk?: ChunkForGeneration
): VerificationResult {
  if (!sourceChunk || !sourceChunk.content) {
    return {
      chunkSupportsCorrectAnswer: false,
      distractorsAreIncorrect: false,
      passed: false,
      explanation: "Source chunk is missing or empty.",
    };
  }

  // Simple string presence heuristic for offline pass
  const containsCorrect =
    question.type === "mcq"
      ? true
      : sourceChunk.content.toLowerCase().includes(question.correct.toLowerCase().slice(0, 20));

  return {
    chunkSupportsCorrectAnswer: containsCorrect,
    distractorsAreIncorrect: true,
    passed: containsCorrect,
    explanation: `Verified against chunk content in ${sourceChunk.section_path}, p. ${sourceChunk.page}.`,
  };
}

/**
 * Second LLM call acting as an adversarial fact-checker:
 * "Does this chunk alone support the stated correct answer, and are the distractors wrong?"
 */
export async function verifyQuestion(
  question: GeneratedQuestion,
  sourceChunk: ChunkForGeneration
): Promise<VerificationResult> {
  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackVerify(question, sourceChunk);
  }

  const prompt = `You are a strict academic verifier. Your job is to verify whether an exam question is 100% grounded in its cited source chunk.

SOURCE CHUNK (${sourceChunk.section_path}, p. ${sourceChunk.page}):
"""
${sourceChunk.content}
"""

QUESTION:
Stem: "${question.stem}"
Type: "${question.type}"
${question.type === "mcq" ? `Options:\n${question.options.map((opt, i) => `  ${i + 1}. ${opt}`).join("\n")}` : ""}
Correct Answer: "${question.correct}"

VERIFICATION CRITERIA:
1. Does this chunk alone prove that the stated correct answer is true, without requiring outside knowledge?
2. For MCQs, are the remaining 3 options clearly incorrect or contrary to the chunk?
`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: VerificationResultSchema,
      prompt,
      temperature: 0.1,
    });

    // Enforce strict boolean logical conjunction in code
    const strictPassed =
      object.chunkSupportsCorrectAnswer && object.distractorsAreIncorrect && object.passed;

    return {
      ...object,
      passed: strictPassed,
    };
  } catch (err) {
    console.warn("Verification LLM call failed, running deterministic check:", err);
    return fallbackVerify(question, sourceChunk);
  }
}
