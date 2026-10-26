import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { generateQuestion, ChunkForGeneration } from "@/lib/ai/genQuestion";
import { verifyQuestion } from "@/lib/ai/verifyQuestion";

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
    let { topicIds, questionCount = 5 } = body;
    questionCount = Math.min(Math.max(questionCount || 5, 1), 15);

    // 1. Fetch target topics
    let query = supabase.from("topics").select("id, name, description, weight").eq("user_id", userId);
    if (topicIds && Array.isArray(topicIds) && topicIds.length > 0) {
      query = query.in("id", topicIds);
    }
    const { data: topics } = await query;

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "No topics found. Please generate or select topics first." }, { status: 400 });
    }

    // 2. Fetch past-paper chunks for style calibration
    const { data: pastPaperDocs } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "past_paper");

    let pastPaperChunks: ChunkForGeneration[] = [];
    if (pastPaperDocs && pastPaperDocs.length > 0) {
      const pDocIds = pastPaperDocs.map((d: any) => d.id);
      const { data: pChunks } = await supabase
        .from("chunks")
        .select("id, section_path, page, content")
        .in("document_id", pDocIds)
        .limit(6);

      pastPaperChunks = (pChunks || []).map((c: any) => ({
        id: c.id,
        section_path: c.section_path,
        page: c.page,
        content: c.content,
        isPastPaper: true,
      }));
    }

    // 3. Generate questions distributed across chosen topics
    const generatedQuestions: any[] = [];
    const questionsPerTopic = Math.ceil(questionCount / topics.length);
    const difficulties: (1 | 2 | 3)[] = [1, 2, 3];

    for (const topic of topics) {
      if (generatedQuestions.length >= questionCount) break;

      // Hybrid retrieve chunks for this topic
      const retrieval = await retrieveChunks(topic.name + " " + topic.description, userId, {
        topicId: topic.id,
        topK: 6,
      });

      if (retrieval.chunks.length === 0) continue;

      const chunksForGen: ChunkForGeneration[] = retrieval.chunks.map((c) => ({
        id: c.id,
        section_path: c.section_path,
        page: c.page,
        content: c.content,
      }));

      const numToGen = Math.min(questionsPerTopic, questionCount - generatedQuestions.length);

      for (let i = 0; i < numToGen; i++) {
        const difficulty = difficulties[i % difficulties.length];
        const type: "mcq" | "short_answer" = i % 4 === 3 ? "short_answer" : "mcq";

        // Generate question strictly grounded in retrieved chunks
        const question = await generateQuestion(topic.name, chunksForGen, {
          targetDifficulty: difficulty,
          targetType: type,
          pastPaperChunks,
        });

        const sourceChunk = chunksForGen.find((c) => c.id === question.source_chunk_id) || chunksForGen[0];

        // Adversarial verification LLM call
        const verification = await verifyQuestion(question, sourceChunk);

        // Save question to database
        const qId = crypto.randomUUID();
        await supabase.from("questions").insert({
          id: qId,
          user_id: userId,
          topic_id: topic.id,
          type: question.type,
          stem: question.stem,
          options: question.options,
          correct: question.correct,
          difficulty: question.difficulty,
          source_chunk_id: sourceChunk.id,
          verified: verification.passed,
        });

        // Client payload hides exact 'correct' field to ensure fair evaluation
        generatedQuestions.push({
          id: qId,
          topic_id: topic.id,
          topic_name: topic.name,
          type: question.type,
          stem: question.stem,
          options: question.options,
          difficulty: question.difficulty,
          source_chunk_id: sourceChunk.id,
          citation: `${sourceChunk.section_path}, p. ${sourceChunk.page}`,
        });
      }
    }

    if (generatedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate questions. Ensure your documents have been uploaded and topics assigned." },
        { status: 400 }
      );
    }

    // 4. Create attempt record in database
    const attemptId = crypto.randomUUID();
    const finalTopicIds = topics.map((t: any) => t.id);

    await supabase.from("attempts").insert({
      id: attemptId,
      user_id: userId,
      topic_ids: finalTopicIds,
      score: 0,
      total_questions: generatedQuestions.length,
      status: "in_progress",
    });

    return NextResponse.json({
      attemptId,
      questions: generatedQuestions,
      total: generatedQuestions.length,
    });
  } catch (err: any) {
    console.error("Quiz creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
