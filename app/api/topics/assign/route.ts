import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assignChunksToTopics } from "@/lib/rag/assign";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const threshold = body.threshold || 0.38;

    // Fetch topics with embeddings
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, description, embedding")
      .eq("user_id", userId);

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "No topics found. Please generate topics first." }, { status: 400 });
    }

    // Fetch chunks with embeddings
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id, content, section_path, embedding")
      .eq("user_id", userId);

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "No chunks found. Please upload documents first." }, { status: 400 });
    }

    const assignments = await assignChunksToTopics(chunks, topics, threshold);

    // Update chunk records
    let assignedCount = 0;
    let uncoveredCount = 0;

    for (const item of assignments) {
      if (item.topicId) {
        assignedCount++;
      } else {
        uncoveredCount++;
      }

      await supabase
        .from("chunks")
        .update({ topic_id: item.topicId })
        .eq("id", item.chunkId)
        .eq("user_id", userId);
    }

    return NextResponse.json({
      success: true,
      totalChunks: chunks.length,
      assignedCount,
      uncoveredCount,
      threshold,
      message: `Assigned ${assignedCount} chunks across ${topics.length} topics. ${uncoveredCount} chunks remain uncovered.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
