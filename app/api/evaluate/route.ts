import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateAnswer } from "@/lib/ai/evaluate";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attemptId, questionId, givenAnswer } = await req.json();

    if (!attemptId || !questionId || givenAnswer === undefined) {
      return NextResponse.json({ error: "attemptId, questionId and givenAnswer are required" }, { status: 400 });
    }

    // 1. Fetch question from DB
    const { data: question, error: qError } = await supabase
      .from("questions")
      .select("id, stem, type, correct, difficulty, source_chunk_id, topic_id")
      .eq("id", questionId)
      .single();

    if (qError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // 2. Fetch source chunk from DB
    const { data: chunk, error: cError } = await supabase
      .from("chunks")
      .select("id, section_path, page, content")
      .eq("id", question.source_chunk_id)
      .single();

    const sourceChunk = chunk || {
      id: question.source_chunk_id,
      section_path: "Course Notes",
      page: 1,
      content: question.correct,
    };

    // 3. Evaluate answer: Pure TS for MCQs, LLM rubric for short answers
    const evaluation = await evaluateAnswer(
      question.stem,
      question.type as "mcq" | "short_answer",
      givenAnswer,
      question.correct,
      sourceChunk
    );

    // 4. Record answer in DB
    const answerId = crypto.randomUUID();
    await supabase.from("answers").insert({
      id: answerId,
      user_id: userId,
      attempt_id: attemptId,
      question_id: questionId,
      given: givenAnswer,
      is_correct: evaluation.is_correct,
      score: evaluation.score,
      explanation: evaluation.explanation,
    });

    // 5. Check if all questions in attempt are answered
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("score")
      .eq("attempt_id", attemptId)
      .eq("user_id", userId);

    const { data: attempt } = await supabase
      .from("attempts")
      .select("total_questions")
      .eq("id", attemptId)
      .single();

    const totalQuestions = attempt?.total_questions || 1;
    const answeredCount = allAnswers?.length || 1;
    const isCompleted = answeredCount >= totalQuestions;

    if (isCompleted) {
      const totalScore = allAnswers?.reduce((sum: number, a: any) => sum + (a.score || 0), 0) || 0;
      await supabase
        .from("attempts")
        .update({
          score: Number((totalScore / totalQuestions).toFixed(3)),
          status: "completed",
        })
        .eq("id", attemptId)
        .eq("user_id", userId);
    }

    return NextResponse.json({
      success: true,
      is_correct: evaluation.is_correct,
      score: evaluation.score,
      explanation: evaluation.explanation,
      cited_quote: evaluation.cited_quote,
      citation: evaluation.citation,
      sourceChunkContent: sourceChunk.content,
      sectionPath: sourceChunk.section_path,
      page: sourceChunk.page,
      isCompleted,
    });
  } catch (err: any) {
    console.error("Evaluation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
