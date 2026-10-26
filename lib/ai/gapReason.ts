import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";
import { MasteryBand } from "@/lib/types/database";

export interface CodeComputedFacts {
  topicName: string;
  score: number;
  percentage: number;
  band: MasteryBand;
  n_questions: number;
  missedSections: string[];
  missedStems: string[];
}

export const GapReasonSchema = z.object({
  reason: z
    .string()
    .describe("Exactly ONE sentence explaining the diagnostic reason, citing specific missed sections or confirmed mastery without hallucinating new topics."),
});

/**
 * Deterministic fallback generator for topic diagnostic reasoning.
 */
export function fallbackGapReason(facts: CodeComputedFacts): string {
  if (facts.band === "unassessed") {
    return `Only ${facts.n_questions} question(s) attempted; at least 2 questions are required to formulate a reliable assessment.`;
  }

  if (facts.band === "weak") {
    if (facts.missedSections.length > 0) {
      return `Scored ${facts.percentage}% with consistent gaps identified in ${facts.missedSections.slice(0, 2).join(" and ")}.`;
    }
    return `Scored ${facts.percentage}% across ${facts.n_questions} questions, requiring targeted revision of core concepts.`;
  }

  if (facts.band === "medium") {
    if (facts.missedSections.length > 0) {
      return `Demonstrates working knowledge (${facts.percentage}%) but struggled on higher-difficulty questions in ${facts.missedSections[0]}.`;
    }
    return `Moderate comprehension at ${facts.percentage}%; requires practice to solidify edge cases.`;
  }

  // Strong
  return `Strong mastery demonstrated (${facts.percentage}%) across ${facts.n_questions} evaluated questions.`;
}

/**
 * Generates exactly ONE sentence of diagnostic reason.
 * ENFORCEMENT: Receives code-computed facts only. The LLM has no authority
 * over the band or score, only verbalizing the deterministic diagnosis.
 */
export async function generateGapReason(facts: CodeComputedFacts): Promise<string> {
  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackGapReason(facts);
  }

  const prompt = `You are an academic diagnostician. Write exactly ONE sentence explaining the student's mastery status for the topic "${facts.topicName}".

DETERMINISTIC CODE FACTS (YOU CANNOT CHANGE THESE):
- Topic: ${facts.topicName}
- Deterministic Band: ${facts.band.toUpperCase()}
- Score: ${facts.percentage}% (${facts.score})
- Questions Attempted: ${facts.n_questions}
- Missed Concepts / Sections: ${facts.missedSections.length > 0 ? facts.missedSections.join(", ") : "None"}
- Sample Missed Question Stems: ${facts.missedStems.length > 0 ? facts.missedStems.slice(0, 2).join("; ") : "None"}

INSTRUCTIONS:
1. Write EXACTLY ONE concise sentence.
2. Directly reference the specific missed sections or confirmed understanding.
3. Do NOT contradict or change the assigned band (${facts.band}).
`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: GapReasonSchema,
      prompt,
      temperature: 0.2,
    });

    const trimmed = object.reason.trim();
    // Guarantee single sentence by stopping at first terminal punctuation if multiple were produced
    const singleSentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0] || trimmed;
    return singleSentence;
  } catch (err) {
    console.warn("Gap reason LLM call failed, returning deterministic string:", err);
    return fallbackGapReason(facts);
  }
}
