import { cosineSimilarity } from "./similarity";
import { embedTexts } from "./embed";

export interface TopicForAssignment {
  id: string;
  name: string;
  description: string;
  embedding: number[] | null;
}

export interface ChunkForAssignment {
  id: string;
  content: string;
  section_path: string;
  embedding: number[] | null;
}

export interface AssignmentResult {
  chunkId: string;
  topicId: string | null;
  similarity: number;
  isUncovered: boolean;
}

export const DEFAULT_ASSIGNMENT_THRESHOLD = 0.38;

/**
 * Pure function to map chunks to the nearest topic above a similarity threshold.
 * Chunks below threshold are flagged as uncovered material.
 */
export function matchChunkToTopics(
  chunk: ChunkForAssignment,
  topicsWithEmbeddings: TopicForAssignment[],
  threshold = DEFAULT_ASSIGNMENT_THRESHOLD
): AssignmentResult {
  if (!chunk.embedding || topicsWithEmbeddings.length === 0) {
    return {
      chunkId: chunk.id,
      topicId: null,
      similarity: 0,
      isUncovered: true,
    };
  }

  let bestTopicId: string | null = null;
  let maxSimilarity = -1;

  for (const topic of topicsWithEmbeddings) {
    if (!topic.embedding) continue;
    const sim = cosineSimilarity(chunk.embedding, topic.embedding);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      bestTopicId = topic.id;
    }
  }

  const isCovered = maxSimilarity >= threshold && bestTopicId !== null;

  return {
    chunkId: chunk.id,
    topicId: isCovered ? bestTopicId : null,
    similarity: Math.max(0, maxSimilarity),
    isUncovered: !isCovered,
  };
}

/**
 * Batch assigns chunks to topics, ensuring topic embeddings exist.
 */
export async function assignChunksToTopics(
  chunks: ChunkForAssignment[],
  topics: TopicForAssignment[],
  threshold = DEFAULT_ASSIGNMENT_THRESHOLD
): Promise<AssignmentResult[]> {
  // Ensure all topics have 768-dim embeddings
  const missingTopicEmbeddings = topics.filter((t) => !t.embedding || t.embedding.length === 0);
  if (missingTopicEmbeddings.length > 0) {
    const textsToEmbed = missingTopicEmbeddings.map((t) => `${t.name}: ${t.description}`);
    const generatedEmbeddings = await embedTexts(textsToEmbed);
    missingTopicEmbeddings.forEach((t, i) => {
      t.embedding = generatedEmbeddings[i];
    });
  }

  return chunks.map((chunk) => matchChunkToTopics(chunk, topics, threshold));
}
