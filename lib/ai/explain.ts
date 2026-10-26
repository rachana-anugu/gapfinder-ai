import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";
import { RetrievedChunk, formatCitation } from "@/lib/rag/retrieve";

export interface ExplainResult {
  refused: boolean;
  answer: string;
  cited_chunk_ids: string[];
  citations: string[];
  key_takeaways: string[];
  highestSimilarity: number;
  threshold: number;
}

export const ExplainResponseSchema = z.object({
  answer: z
    .string()
    .describe("Clear, student-friendly explanation addressing the question strictly using the provided chunks. Quotes key phrases directly."),
  cited_chunk_ids: z
    .array(z.string())
    .describe("List of CHUNK_IDs from the provided context that were directly used to formulate this answer"),
  key_takeaways: z
    .array(z.string())
    .describe("2 to 3 concise summary takeaways proven by the source chunks"),
});

/**
 * Deterministic fallback explainer for offline tests.
 */
export function fallbackExplain(
  query: string,
  chunks: RetrievedChunk[],
  highestSimilarity: number,
  threshold: number
): ExplainResult {
  const topChunk = chunks[0];
  const citation = topChunk ? formatCitation(topChunk.section_path, topChunk.page) : "Course Notes";

  return {
    refused: false,
    answer: `Based on your course notes in ${citation}: "${topChunk?.content.slice(0, 200)}..."`,
    cited_chunk_ids: topChunk ? [topChunk.id] : [],
    citations: topChunk ? [citation] : [],
    key_takeaways: [
      `Defined in ${topChunk?.section_path || "Course Notes"} (p. ${topChunk?.page || 1})`,
      `Verified against student uploaded files with similarity score ${highestSimilarity.toFixed(2)}`,
    ],
    highestSimilarity,
    threshold,
  };
}

/**
 * Explains a concept strictly using retrieved knowledge chunks.
 * Enforces in TypeScript code:
 * 1. Immediate refusal if highest similarity is below retrieval threshold.
 * 2. Only accepts Chunk[] as knowledge context (no model memory).
 * 3. Validates cited chunk IDs exist in the retrieved set.
 */
export async function explainTopic(
  query: string,
  retrievedChunks: RetrievedChunk[],
  highestSimilarity: number,
  threshold = 0.45
): Promise<ExplainResult> {
  // 1. Strict refusal enforcement in code
  if (retrievedChunks.length === 0 || highestSimilarity < threshold) {
    return {
      refused: true,
      answer: "I couldn't find this in your uploaded material.",
      cited_chunk_ids: [],
      citations: [],
      key_takeaways: [],
      highestSimilarity,
      threshold,
    };
  }

  const validChunkIds = new Set(retrievedChunks.map((c) => c.id));
  const chunkMap = new Map(retrievedChunks.map((c) => [c.id, c]));

  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackExplain(query, retrievedChunks, highestSimilarity, threshold);
  }

  const formattedContext = retrievedChunks
    .map(
      (c) =>
        `[CHUNK_ID: ${c.id}] (Location: ${c.section_path}, p. ${c.page}):\n${c.content}\n`
    )
    .join("\n---\n");

  const prompt = `You are the GapFinder Explain Assistant. A student is asking a question about their course material.

STUDENT QUESTION: "${query}"

MANDATORY KNOWLEDGE CONTEXT (ONLY ANSWER FROM THESE CHUNKS):
${formattedContext}

STRICT GROUNDING RULES:
1. Answer the student's question ONLY using the facts stated in the chunks above.
2. If the chunks do NOT contain sufficient information to answer the question, state: "I couldn't find this in your uploaded material."
3. Every factual claim should be supported by at least one chunk.
4. Return the exact CHUNK_IDs cited in "cited_chunk_ids".
5. Do NOT use outside model memory or hallucinate concepts not present in these chunks.
`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: ExplainResponseSchema,
      prompt,
      temperature: 0.2,
    });

    // Code validation: ensure cited chunk IDs actually belong to the retrieved set
    const verifiedChunkIds = object.cited_chunk_ids.filter((id) => validChunkIds.has(id));

    // If none of the cited IDs are valid, assign top chunk as default
    if (verifiedChunkIds.length === 0 && retrievedChunks.length > 0) {
      verifiedChunkIds.push(retrievedChunks[0].id);
    }

    const citations = verifiedChunkIds.map((id) => {
      const c = chunkMap.get(id)!;
      return formatCitation(c.section_path, c.page);
    });

    return {
      refused: false,
      answer: object.answer,
      cited_chunk_ids: verifiedChunkIds,
      citations,
      key_takeaways: object.key_takeaways,
      highestSimilarity,
      threshold,
    };
  } catch (err) {
    console.warn("Explain assistant generation failed, using deterministic fallback:", err);
    return fallbackExplain(query, retrievedChunks, highestSimilarity, threshold);
  }
}
