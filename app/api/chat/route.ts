import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { explainTopic } from "@/lib/ai/explain";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, topicId } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Hybrid retrieval (vector + tsvector keyword, merged with RRF)
    const retrieval = await retrieveChunks(message.trim(), userId, {
      topicId: topicId || null,
      topK: 6,
    });

    // 2. Strict Grounded Explanation with Refusal below threshold
    const result = await explainTopic(
      message.trim(),
      retrieval.chunks,
      retrieval.highestSimilarity,
      retrieval.threshold
    );

    // Filter cited chunks for direct client drawer inspection
    const citedChunks = retrieval.chunks.filter((c) =>
      result.cited_chunk_ids.includes(c.id)
    );

    return NextResponse.json({
      refused: result.refused,
      answer: result.answer,
      citations: result.citations,
      key_takeaways: result.key_takeaways,
      highestSimilarity: result.highestSimilarity,
      threshold: result.threshold,
      chunks: citedChunks.length > 0 ? citedChunks : retrieval.chunks.slice(0, 2),
    });
  } catch (err: any) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
