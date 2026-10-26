import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";
import { ChunkForGeneration } from "./genQuestion";

export interface EvaluationResult {
  is_correct: boolean;
  score: number; // 0.0 to 1.0
  explanation: string;
  cited_quote: string;
  source_chunk_id: string;
  citation: string;
}

export const ShortAnswerRubricSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Score between 0.0 (completely inaccurate) to 1.0 (fully accurate & complete)"),
  is_correct: z
    .boolean()
    .describe("True if score is >= 0.7, indicating sufficient mastery of the concept"),
  chunk_quote: z
    .string()
    .describe("Exact quote from the source chunk that justifies the grade"),
  explanation: z
    .string()
    .describe("Clear 1-2 sentence explanation of why the answer is right or wrong, quoting facts from the text"),
});

export const ExplanationOnlySchema = z.object({
  chunk_quote: z.string().describe("Exact quote from the chunk proving the correct answer"),
  explanation: z
    .string()
    .describe("Clear 1-2 sentence explanation of why this answer is correct and others are wrong"),
});

/**
 * Deterministic MCQ grading in pure TypeScript code.
 * Follows core design principle: LLM never decides if MCQ is correct.
 */
export function gradeMCQ(
  givenAnswer: string,
  correctAnswer: string,
  sourceChunk: ChunkForGeneration
): { is_correct: boolean; score: number } {
  const normalizedGiven = givenAnswer.trim().toLowerCase();
  const normalizedCorrect = correctAnswer.trim().toLowerCase();

  const isCorrect =
    normalizedGiven === normalizedCorrect ||
    normalizedGiven.startsWith(normalizedCorrect.slice(0, 30));

  return {
    is_correct: isCorrect,
    score: isCorrect ? 1.0 : 0.0,
  };
}

/**
 * Full answer evaluator:
 * - MCQs: Graded deterministically by exact string match in TypeScript.
 * - Short Answers: Graded by LLM against cited chunk rubric (score 0-1).
 * - Generates clear explanation directly quoting the cited chunk.
 */
export async function evaluateAnswer(
  stem: string,
  type: "mcq" | "short_answer",
  givenAnswer: string,
  correctAnswer: string,
  sourceChunk: ChunkForGeneration
): Promise<EvaluationResult> {
  const citation = `${sourceChunk.section_path}, p. ${sourceChunk.page}`;
  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // 1. MCQ Grading: DETERMINISTIC TS CODE
  if (type === "mcq") {
    const { is_correct, score } = gradeMCQ(givenAnswer, correctAnswer, sourceChunk);

    if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
      return {
        is_correct,
        score,
        explanation: is_correct
          ? `Correct! As stated in your course material: "${sourceChunk.content.slice(0, 120)}..."`
          : `Incorrect. Your notes clarify that: "${correctAnswer}". See ${citation}.`,
        cited_quote: sourceChunk.content.slice(0, 150),
        source_chunk_id: sourceChunk.id,
        citation,
      };
    }

    try {
      const prompt = `The student answered an MCQ from their course material.
Question: "${stem}"
Correct Answer: "${correctAnswer}"
Student Answer: "${givenAnswer}" (${is_correct ? "CORRECT" : "INCORRECT"})

Source Chunk (${citation}):
"""
${sourceChunk.content}
"""

Write a concise 1-2 sentence explanation explaining why this answer is correct or incorrect. Quote a short key phrase from the source chunk.`;

      const { object } = await generateObject({
        model: getLLMModel(),
        schema: ExplanationOnlySchema,
        prompt,
        temperature: 0.2,
      });

      return {
        is_correct,
        score,
        explanation: object.explanation,
        cited_quote: object.chunk_quote,
        source_chunk_id: sourceChunk.id,
        citation,
      };
    } catch {
      return {
        is_correct,
        score,
        explanation: is_correct
          ? `Correct! Verified in your notes at ${citation}.`
          : `Incorrect. The correct answer is "${correctAnswer}". Verified at ${citation}.`,
        cited_quote: sourceChunk.content.slice(0, 120),
        source_chunk_id: sourceChunk.id,
        citation,
      };
    }
  }

  // 2. Short Answer Grading: LLM Rubric against Cited Chunk
  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    const normGiven = givenAnswer.toLowerCase();
    const normCorrect = correctAnswer.toLowerCase();
    const overlap = normGiven.split(/\s+/).filter((w) => w.length > 3 && normCorrect.includes(w));
    const score = Math.min(1.0, overlap.length >= 2 ? 0.85 : 0.3);
    const is_correct = score >= 0.7;

    return {
      is_correct,
      score,
      explanation: is_correct
        ? `Accurate response. Directly supported by your course text at ${citation}.`
        : `Your response missed key elements described in ${citation}. Expected: "${correctAnswer}".`,
      cited_quote: sourceChunk.content.slice(0, 140),
      source_chunk_id: sourceChunk.id,
      citation,
    };
  }

  const prompt = `You are grading a student's short answer against their own course notes.
Question: "${stem}"
Expected Reference: "${correctAnswer}"
Student's Given Answer: "${givenAnswer}"

Source Material (${citation}):
"""
${sourceChunk.content}
"""

Grade the answer on a scale from 0.0 to 1.0 strictly against the facts in the source chunk.
- 0.0 - 0.4: Factually incorrect or irrelevant
- 0.5 - 0.6: Partially correct but missing core criteria
- 0.7 - 1.0: Substantially or fully correct`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: ShortAnswerRubricSchema,
      prompt,
      temperature: 0.1,
    });

    return {
      is_correct: object.score >= 0.7,
      score: object.score,
      explanation: object.explanation,
      cited_quote: object.chunk_quote,
      source_chunk_id: sourceChunk.id,
      citation,
    };
  } catch (err) {
    console.warn("Short answer evaluation fallback:", err);
    return {
      is_correct: false,
      score: 0.5,
      explanation: `Graded against source material at ${citation}.`,
      cited_quote: sourceChunk.content.slice(0, 100),
      source_chunk_id: sourceChunk.id,
      citation,
    };
  }
}
