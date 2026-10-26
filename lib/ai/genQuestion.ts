import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";

export interface ChunkForGeneration {
  id: string;
  section_path: string;
  page: number;
  content: string;
  isPastPaper?: boolean;
}

export const GeneratedQuestionSchema = z.object({
  type: z.enum(["mcq", "short_answer"]).describe("Question type"),
  stem: z.string().describe("The question text testing conceptual understanding or application"),
  options: z
    .array(z.string())
    .describe("Exactly 4 distinct options for MCQs. Must be empty array for short_answer."),
  correct: z
    .string()
    .describe("The correct answer. For MCQ, must exactly match one of the 4 options."),
  difficulty: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .describe("1: Recall/Definition, 2: Application/Mechanism, 3: Complex Analysis/Edge cases"),
  source_chunk_id: z
    .string()
    .describe("Must be the exact ID of the provided chunk supporting this question"),
  reasoning: z
    .string()
    .describe("Brief quote or explanation from the chunk proving the correct answer"),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

/**
 * Deterministic fallback generator for offline testing or when API keys are absent.
 */
export function fallbackQuestion(
  topicName: string,
  chunks: ChunkForGeneration[],
  targetDifficulty: 1 | 2 | 3 = 1,
  targetType: "mcq" | "short_answer" = "mcq"
): GeneratedQuestion {
  const chunk = chunks[0] || {
    id: "chunk-fallback-1",
    section_path: topicName,
    page: 1,
    content: `Default content for ${topicName}.`,
  };

  const firstSentence = chunk.content.split(/[.\n]/)[0] || topicName;

  if (targetType === "short_answer") {
    return {
      type: "short_answer",
      stem: `Based on your course notes in "${chunk.section_path}", explain the core concept described: "${firstSentence.slice(0, 100)}..."`,
      options: [],
      correct: firstSentence,
      difficulty: targetDifficulty,
      source_chunk_id: chunk.id,
      reasoning: `Supported directly by text: ${firstSentence}`,
    };
  }

  return {
    type: "mcq",
    stem: `According to your study material in "${chunk.section_path}", which statement correctly describes this concept?`,
    options: [
      `${firstSentence.slice(0, 90)}.`,
      `It operates independently without any prerequisite requirements.`,
      `It is superseded by secondary protocols during routine execution.`,
      `It solely handles background cleanup operations.`,
    ],
    correct: `${firstSentence.slice(0, 90)}.`,
    difficulty: targetDifficulty,
    source_chunk_id: chunk.id,
    reasoning: `Supported by section ${chunk.section_path}, p. ${chunk.page}`,
  };
}

/**
 * Generates a question strictly grounded in the provided chunks.
 * Enforces in TypeScript code:
 * 1. Accepts only Chunk[] as its knowledge context.
 * 2. Validates that source_chunk_id is present in the input chunks set.
 * 3. Retries up to 2 times if source_chunk_id is missing or hallucinated.
 */
export async function generateQuestion(
  topicName: string,
  chunks: ChunkForGeneration[],
  options: {
    targetDifficulty?: 1 | 2 | 3;
    targetType?: "mcq" | "short_answer";
    pastPaperChunks?: ChunkForGeneration[];
  } = {}
): Promise<GeneratedQuestion> {
  if (!chunks || chunks.length === 0) {
    throw new Error("Cannot generate question: No knowledge chunks provided in context.");
  }

  const validChunkIds = new Set(chunks.map((c) => c.id));
  const targetDifficulty = options.targetDifficulty || 2;
  const targetType = options.targetType || "mcq";

  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackQuestion(topicName, chunks, targetDifficulty, targetType);
  }

  const formattedChunks = chunks
    .map(
      (c) =>
        `[CHUNK_ID: ${c.id}] (Location: ${c.section_path}, p. ${c.page}):\n${c.content}\n`
    )
    .join("\n---\n");

  const pastPaperSection = options.pastPaperChunks && options.pastPaperChunks.length > 0
    ? `\nStyle Calibration from Past Exam Papers (DO NOT copy questions verbatim; use to match tone & depth):\n${options.pastPaperChunks
        .map((p) => p.content.slice(0, 400))
        .join("\n---\n")}\n`
    : "";

  const systemInstruction = `You are a rigorous exam question creator for the topic "${topicName}".
NON-NEGOTIABLE GROUNDING RULES:
1. You must ONLY formulate a question whose answer is explicitly and unambiguously stated in ONE of the provided chunks.
2. Under no circumstance may you answer or ask from model memory.
3. You must select one CHUNK_ID from the provided chunks as the "source_chunk_id".
4. For MCQs: provide exactly 4 options. Make distractors plausible but unequivocally incorrect based on the cited chunk. The correct option must match the "correct" field verbatim.
5. Target difficulty: ${targetDifficulty} (1=Recall/definition, 2=Application/mechanism, 3=Analysis/edge-case).
6. Target format: ${targetType}.
`;

  const prompt = `${systemInstruction}

Available Course Material Chunks:
${formattedChunks}
${pastPaperSection}
`;

  let attempts = 0;
  const maxAttempts = 3; // Initial attempt + up to 2 retries

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const { object } = await generateObject({
        model: getLLMModel(),
        schema: GeneratedQuestionSchema,
        prompt,
        temperature: 0.3,
      });

      // Strict code-level validation of source_chunk_id
      if (validChunkIds.has(object.source_chunk_id)) {
        // Enforce MCQ option consistency
        if (object.type === "mcq") {
          if (!object.options.includes(object.correct)) {
            object.options[0] = object.correct;
          }
        }
        return object;
      }

      console.warn(
        `Attempt ${attempts}: source_chunk_id "${object.source_chunk_id}" not found in retrieved chunks. Retrying...`
      );
    } catch (err) {
      console.warn(`Attempt ${attempts} question generation failed:`, err);
    }
  }

  // If retries fail, fall back to safe deterministic question from first chunk
  return fallbackQuestion(topicName, chunks, targetDifficulty, targetType);
}
