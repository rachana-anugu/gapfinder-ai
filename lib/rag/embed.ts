import { embed, embedMany, EmbeddingModel } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export const FIXED_EMBEDDING_DIM = 768;

/**
 * Returns the swappable embedding model configured with 768 dimensions.
 */
export function getEmbeddingModel(): EmbeddingModel<string> {
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

  if (provider === "openai") {
    return openai.textEmbeddingModel("text-embedding-3-small", {
      dimensions: FIXED_EMBEDDING_DIM,
    });
  }

  // Default: Google Gemini text-embedding-004 (natively 768 dimensions)
  return google.textEmbeddingModel("text-embedding-004");
}

/**
 * Deterministic pseudo-embedding generator of 768 dimensions used when
 * external API keys are placeholder or not provided (e.g. CI / offline testing).
 */
export function getMockEmbedding(text: string): number[] {
  const vector = new Array(FIXED_EMBEDDING_DIM).fill(0);
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * 31 + i * 17) % FIXED_EMBEDDING_DIM;
    vector[index] += Math.sin(charCode + i);
  }

  // L2 normalize
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((val) => Number((val / norm).toFixed(6)));
}

/**
 * Embeds a single text string into a 768-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return getMockEmbedding(text);
  }

  try {
    const model = getEmbeddingModel();
    const result = await embed({
      model,
      value: text.slice(0, 8000),
    });
    return result.embedding.slice(0, FIXED_EMBEDDING_DIM);
  } catch (error) {
    console.warn("Embedding API call failed; falling back to deterministic vector:", error);
    return getMockEmbedding(text);
  }
}

/**
 * Batch embeds an array of text strings into 768-dimensional vectors.
 */
export async function embedTexts(texts: string[], batchSize = 16): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return texts.map(getMockEmbedding);
  }

  try {
    const model = getEmbeddingModel();
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize).map((t) => t.slice(0, 8000));
      const result = await embedMany({
        model,
        values: slice,
      });
      allEmbeddings.push(...result.embeddings.map((e) => e.slice(0, FIXED_EMBEDDING_DIM)));
    }

    return allEmbeddings;
  } catch (error) {
    console.warn("Batch embedding API call failed; falling back to deterministic vectors:", error);
    return texts.map(getMockEmbedding);
  }
}
