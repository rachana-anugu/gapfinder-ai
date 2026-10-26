import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateTopicMap } from "@/lib/ai/topicMap";
import { embedTexts } from "@/lib/rag/embed";
import { assignChunksToTopics } from "@/lib/rag/assign";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch topics
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, parent_id, name, description, weight, created_at")
      .eq("user_id", userId)
      .order("weight", { ascending: false });

    if (topicsError) {
      return NextResponse.json({ topics: [], uncoveredChunks: [] });
    }

    // Fetch chunk distributions
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id, topic_id, section_path, page, content")
      .eq("user_id", userId);

    const chunkCounts: Record<string, number> = {};
    const uncoveredChunks: any[] = [];

    chunks?.forEach((c: any) => {
      if (c.topic_id) {
        chunkCounts[c.topic_id] = (chunkCounts[c.topic_id] || 0) + 1;
      } else {
        uncoveredChunks.push({
          id: c.id,
          section_path: c.section_path,
          page: c.page,
          content: c.content.slice(0, 200) + "...",
        });
      }
    });

    const enrichedTopics = (topics || []).map((t: any) => ({
      ...t,
      chunk_count: chunkCounts[t.id] || 0,
    }));

    return NextResponse.json({
      topics: enrichedTopics,
      uncoveredChunks,
      totalChunks: chunks?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch uploaded syllabus text and optional past paper text
    const { data: syllabusDocs } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "syllabus");

    let syllabusText = "";
    if (syllabusDocs && syllabusDocs.length > 0) {
      const docIds = syllabusDocs.map((d: any) => d.id);
      const { data: syllabusChunks } = await supabase
        .from("chunks")
        .select("content, section_path")
        .in("document_id", docIds)
        .order("page", { ascending: true });

      syllabusText = syllabusChunks?.map((c: any) => c.content).join("\n\n") || "";
    }

    // Fallback: if no document tagged as syllabus, gather all uploaded notes
    if (!syllabusText.trim()) {
      const { data: anyChunks } = await supabase
        .from("chunks")
        .select("content, section_path")
        .eq("user_id", userId)
        .limit(20);
      syllabusText = anyChunks?.map((c: any) => `${c.section_path}\n${c.content}`).join("\n\n") || "";
    }

    if (!syllabusText.trim()) {
      return NextResponse.json(
        { error: "No documents found to generate topic tree. Please upload your syllabus or notes first." },
        { status: 400 }
      );
    }

    // Optional past paper text for calibrating weights
    const { data: pastPaperDocs } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "past_paper");

    let pastPaperText: string | undefined = undefined;
    if (pastPaperDocs && pastPaperDocs.length > 0) {
      const pIds = pastPaperDocs.map((d: any) => d.id);
      const { data: pChunks } = await supabase
        .from("chunks")
        .select("content")
        .in("document_id", pIds)
        .limit(10);
      pastPaperText = pChunks?.map((c: any) => c.content).join("\n\n");
    }

    // 2. Generate structured topic tree via Vercel AI SDK generateObject
    const topicTree = await generateTopicMap(syllabusText, pastPaperText);

    // 3. Flatten and embed topics
    const flatTopics: {
      name: string;
      description: string;
      weight: number;
      parent_name?: string;
    }[] = [];

    for (const mainTopic of topicTree.topics) {
      flatTopics.push({
        name: mainTopic.name,
        description: mainTopic.description,
        weight: mainTopic.weight,
      });

      if (mainTopic.subtopics) {
        for (const sub of mainTopic.subtopics) {
          flatTopics.push({
            name: sub.name,
            description: sub.description,
            weight: sub.weight,
            parent_name: mainTopic.name,
          });
        }
      }
    }

    const topicTexts = flatTopics.map((t) => `${t.name}: ${t.description}`);
    const embeddings = await embedTexts(topicTexts);

    // 4. Save main topics first
    const mainTopicMap = new Map<string, string>(); // name -> id
    const createdTopics: any[] = [];

    for (let i = 0; i < flatTopics.length; i++) {
      const t = flatTopics[i];
      if (t.parent_name) continue; // Skip subtopics on first pass

      const id = crypto.randomUUID();
      const { data } = await supabase
        .from("topics")
        .insert({
          id,
          user_id: userId,
          name: t.name,
          description: t.description,
          weight: t.weight,
          embedding: embeddings[i],
        })
        .select("id, name, description, weight")
        .single();

      const savedId = data?.id || id;
      mainTopicMap.set(t.name, savedId);
      createdTopics.push({ id: savedId, ...t, embedding: embeddings[i] });
    }

    // Save subtopics with parent_id
    for (let i = 0; i < flatTopics.length; i++) {
      const t = flatTopics[i];
      if (!t.parent_name) continue;

      const parentId = mainTopicMap.get(t.parent_name) || null;
      const id = crypto.randomUUID();
      const { data } = await supabase
        .from("topics")
        .insert({
          id,
          user_id: userId,
          parent_id: parentId,
          name: t.name,
          description: t.description,
          weight: t.weight,
          embedding: embeddings[i],
        })
        .select("id, name, description, weight, parent_id")
        .single();

      const savedId = data?.id || id;
      createdTopics.push({ id: savedId, ...t, parent_id: parentId, embedding: embeddings[i] });
    }

    // 5. Automatically assign chunks to topics
    const { data: allChunks } = await supabase
      .from("chunks")
      .select("id, content, section_path, embedding")
      .eq("user_id", userId);

    if (allChunks && allChunks.length > 0) {
      const assignments = await assignChunksToTopics(
        allChunks.map((c: any) => ({
          id: c.id,
          content: c.content,
          section_path: c.section_path,
          embedding: c.embedding,
        })),
        createdTopics.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          embedding: t.embedding,
        }))
      );

      // Batch update chunk topic assignments
      for (const assign of assignments) {
        await supabase
          .from("chunks")
          .update({ topic_id: assign.topicId })
          .eq("id", assign.chunkId)
          .eq("user_id", userId);
      }
    }

    return NextResponse.json({
      success: true,
      subject: topicTree.subject,
      topicsCount: createdTopics.length,
      topics: createdTopics,
      message: `Successfully mapped syllabus into ${createdTopics.length} topics and assigned knowledge chunks.`,
    });
  } catch (err: any) {
    console.error("Topic generation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, weight } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ error: "Topic ID and name are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("topics")
      .update({
        name,
        description: description || "",
        weight: weight || 1.0,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Topic updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
