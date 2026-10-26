import { embedText } from "./embed";
import { cosineSimilarity } from "./similarity";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  topic_id: string | null;
  section_path: string;
  page: number;
  content: string;
  similarity: number;
  citation: string;
}

export interface HybridSearchResult {
  chunks: RetrievedChunk[];
  query: string;
  highestSimilarity: number;
  isConfident: boolean;
  threshold: number;
}

export const DEFAULT_RETRIEVAL_THRESHOLD = 0.45;

/**
 * Standard citation formatter: "Section path, p. N"
 */
export function formatCitation(sectionPath: string, page: number): string {
  return `${sectionPath}, p. ${page}`;
}

/**
 * Pure Reciprocal Rank Fusion (RRF) implementation.
 * RRF(d) = sum_{m in rankings} 1 / (k + rank_m(d))
 */
export function reciprocalRankFusion<T extends { id: string }>(
  rankings: T[][],
  k = 60
): { item: T; rrfScore: number }[] {
  const scoreMap = new Map<string, { item: T; score: number }>();

  for (const ranking of rankings) {
    ranking.forEach((item, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      const existing = scoreMap.get(item.id);
      if (existing) {
        existing.score += contribution;
      } else {
        scoreMap.set(item.id, { item, score: contribution });
      }
    });
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({ item: entry.item, rrfScore: entry.score }));
}

/**
 * Performs hybrid retrieval (Vector cosine + Keyword FTS merged with RRF)
 * strictly constrained to the user's material and optional topic filter.
 */
export async function retrieveChunks(
  query: string,
  userId: string,
  options: {
    topicId?: string | null;
    topK?: number;
    threshold?: number;
  } = {}
): Promise<HybridSearchResult> {
  const topK = options.topK || 8;
  const threshold = options.threshold ?? (
    process.env.RETRIEVAL_THRESHOLD ? parseFloat(process.env.RETRIEVAL_THRESHOLD) : DEFAULT_RETRIEVAL_THRESHOLD
  );

  const supabase = await createServerSupabaseClient();
  const queryEmbedding = await embedText(query);

  let vectorMatches: RetrievedChunk[] = [];
  let ftsMatches: RetrievedChunk[] = [];

  // 1. Vector Search via Supabase RPC `match_chunks`
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      filter_user_id: userId,
      filter_topic_id: options.topicId || null,
      k: Math.max(topK * 2, 12),
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
      vectorMatches = rpcData.map((row: any) => ({
        id: row.id,
        document_id: row.document_id,
        topic_id: row.topic_id,
        section_path: row.section_path,
        page: row.page,
        content: row.content,
        similarity: Number(row.similarity || 0),
        citation: formatCitation(row.section_path, row.page),
      }));
    }
  } catch (e) {
    console.warn("RPC match_chunks failed, falling back to manual query:", e);
  }

  // Fallback to direct chunk vector comparison if RPC was unavailable (e.g. placeholder DB)
  if (vectorMatches.length === 0) {
    let queryBuilder = supabase
      .from("chunks")
      .select("id, document_id, topic_id, section_path, page, content, embedding")
      .eq("user_id", userId);

    if (options.topicId) {
      queryBuilder = queryBuilder.eq("topic_id", options.topicId);
    }

    const { data: allChunks } = await queryBuilder.limit(100);

    if (allChunks && allChunks.length > 0) {
      vectorMatches = allChunks
        .map((c: any) => {
          const sim = c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0;
          return {
            id: c.id,
            document_id: c.document_id,
            topic_id: c.topic_id,
            section_path: c.section_path,
            page: c.page,
            content: c.content,
            similarity: sim,
            citation: formatCitation(c.section_path, c.page),
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, Math.max(topK * 2, 12));
    }
  }

  // 2. Keyword Search via FTS RPC or text matching
  try {
    const { data: ftsData, error: ftsError } = await supabase.rpc("match_chunks_fts", {
      search_query: query,
      filter_user_id: userId,
      filter_topic_id: options.topicId || null,
      k: Math.max(topK * 2, 12),
    });

    if (!ftsError && ftsData && ftsData.length > 0) {
      ftsMatches = ftsData.map((row: any) => ({
        id: row.id,
        document_id: row.document_id,
        topic_id: row.topic_id,
        section_path: row.section_path,
        page: row.page,
        content: row.content,
        similarity: 0.5, // placeholder before vector score resolution
        citation: formatCitation(row.section_path, row.page),
      }));
    }
  } catch (e) {
    console.warn("RPC match_chunks_fts fallback to token matching:", e);
  }

  // Fallback keyword scoring if FTS RPC was unavailable
  if (ftsMatches.length === 0 && vectorMatches.length > 0) {
    const queryTokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    ftsMatches = [...vectorMatches]
      .map((c) => {
        const text = (c.section_path + " " + c.content).toLowerCase();
        let matches = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) matches++;
        }
        return { chunk: c, matchCount: matches };
      })
      .filter((m) => m.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map((m) => m.chunk);
  }

  // 3. Reciprocal Rank Fusion (RRF)
  const fused = reciprocalRankFusion([vectorMatches, ftsMatches]);

  // Map fused items back, preserving the vector similarity score
  const vectorScoreMap = new Map(vectorMatches.map((c) => [c.id, c.similarity]));

  const mergedChunks: RetrievedChunk[] = fused.slice(0, topK).map(({ item }) => ({
    ...item,
    similarity: Number((vectorScoreMap.get(item.id) ?? item.similarity).toFixed(4)),
  }));

  // Determine highest similarity among retrieved chunks
  const highestSimilarity = mergedChunks.length > 0
    ? Math.max(...mergedChunks.map((c) => c.similarity))
    : 0;

  const isConfident = highestSimilarity >= threshold;

  return {
    chunks: mergedChunks,
    query,
    highestSimilarity,
    isConfident,
    threshold,
  };
}
