import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceTopicId, targetTopicId } = await req.json();

    if (!sourceTopicId || !targetTopicId) {
      return NextResponse.json({ error: "sourceTopicId and targetTopicId are required" }, { status: 400 });
    }

    if (sourceTopicId === targetTopicId) {
      return NextResponse.json({ error: "Cannot merge a topic into itself" }, { status: 400 });
    }

    // 1. Move all chunks from source topic to target topic
    const { error: moveChunksError } = await supabase
      .from("chunks")
      .update({ topic_id: targetTopicId })
      .eq("topic_id", sourceTopicId)
      .eq("user_id", userId);

    if (moveChunksError) {
      return NextResponse.json({ error: moveChunksError.message }, { status: 500 });
    }

    // 2. Move any subtopics where parent_id = sourceTopicId to targetTopicId
    await supabase
      .from("topics")
      .update({ parent_id: targetTopicId })
      .eq("parent_id", sourceTopicId)
      .eq("user_id", userId);

    // 3. Move questions from source to target
    await supabase
      .from("questions")
      .update({ topic_id: targetTopicId })
      .eq("topic_id", sourceTopicId)
      .eq("user_id", userId);

    // 4. Delete the source topic
    const { error: deleteError } = await supabase
      .from("topics")
      .delete()
      .eq("id", sourceTopicId)
      .eq("user_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Topic merged successfully. All associated chunks and subtopics reassigned.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
