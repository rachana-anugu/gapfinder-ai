import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  computeTopicMastery,
  rollupParentTopics,
  AnswerFact,
  TopicHierarchyNode,
  TopicMasteryComputation,
} from "@/lib/diagnosis/mastery";
import { generateGapReason } from "@/lib/ai/gapReason";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let attemptId = searchParams.get("attemptId");

    // If no attemptId given, find the most recent attempt
    if (!attemptId) {
      const { data: latestAttempt } = await supabase
        .from("attempts")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestAttempt) {
        attemptId = latestAttempt.id;
      }
    }

    // 1. Fetch user's topics
    const { data: rawTopics } = await supabase
      .from("topics")
      .select("id, parent_id, name, description, weight")
      .eq("user_id", userId);

    const topics: TopicHierarchyNode[] = (rawTopics || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      parent_id: t.parent_id,
      weight: Number(t.weight || 1.0),
    }));

    if (topics.length === 0) {
      return NextResponse.json({
        topics: [],
        evidence: [],
        overallScore: 0,
        message: "No topics configured yet.",
      });
    }

    // 2. Fetch all historical attempts to compute recency weights
    const { data: allAttempts } = await supabase
      .from("attempts")
      .select("id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const attemptOrderMap = new Map<string, number>();
    (allAttempts || []).forEach((att: any, idx: number) => {
      attemptOrderMap.set(att.id, idx);
    });

    // 3. Fetch answers (for specific attempt or cumulative history)
    let answersQuery = supabase
      .from("answers")
      .select(
        "id, attempt_id, question_id, given, is_correct, score, explanation, created_at, questions(id, stem, difficulty, topic_id, source_chunk_id, chunks(section_path, page, content))"
      )
      .eq("user_id", userId);

    if (attemptId) {
      answersQuery = answersQuery.eq("attempt_id", attemptId);
    }

    const { data: rawAnswers } = await answersQuery;

    // Build AnswerFacts for deterministic calculation
    const answerFacts: AnswerFact[] = [];
    const evidenceList: any[] = [];

    (rawAnswers || []).forEach((ans: any) => {
      const q = ans.questions;
      const c = q?.chunks;
      const topic = topics.find((t) => t.id === q?.topic_id);
      const attemptsAgo = attemptOrderMap.get(ans.attempt_id) || 0;

      if (q && q.topic_id) {
        answerFacts.push({
          topic_id: q.topic_id,
          topic_name: topic?.name || "Topic",
          is_correct: ans.is_correct,
          score: Number(ans.score || (ans.is_correct ? 1.0 : 0.0)),
          difficulty: (q.difficulty || 1) as 1 | 2 | 3,
          attemptsAgo,
          stem: q.stem,
          cited_section: c?.section_path,
          page: c?.page,
        });

        evidenceList.push({
          answer_id: ans.id,
          question_id: q.id,
          topic_id: q.topic_id,
          topic_name: topic?.name || "General Topic",
          stem: q.stem,
          given: ans.given,
          is_correct: ans.is_correct,
          score: ans.score,
          explanation: ans.explanation,
          citation: c ? `${c.section_path}, p. ${c.page}` : "Course Notes",
          page: c?.page || 1,
          section_path: c?.section_path || "Course Notes",
          content: c?.content || "",
        });
      }
    });

    // 4. Compute direct masteries deterministically
    const directMasteries = new Map<string, TopicMasteryComputation>();
    for (const topic of topics) {
      const comp = computeTopicMastery(topic.id, topic.name, answerFacts);
      directMasteries.set(topic.id, comp);
    }

    // 5. Roll up parent topics using weighted averages
    const rolledMasteries = rollupParentTopics(directMasteries, topics);

    // 6. Generate ONE-sentence diagnostic reason for each topic
    const diagnosedTopics: any[] = [];
    for (const topic of topics) {
      const m = rolledMasteries.get(topic.id) || {
        topic_id: topic.id,
        topic_name: topic.name,
        score: 0,
        percentage: 0,
        n_questions: 0,
        band: "unassessed" as const,
        missed_sections: [],
        missed_stems: [],
      };

      const reason = await generateGapReason({
        topicName: topic.name,
        score: m.score,
        percentage: m.percentage,
        band: m.band,
        n_questions: m.n_questions,
        missedSections: m.missed_sections,
        missedStems: m.missed_stems,
      });

      // Persist in topic_mastery table if we have an attemptId
      if (attemptId) {
        await supabase.from("topic_mastery").upsert({
          user_id: userId,
          attempt_id: attemptId,
          topic_id: topic.id,
          score: m.score,
          n_questions: m.n_questions,
          band: m.band,
          reason,
        });
      }

      diagnosedTopics.push({
        id: topic.id,
        name: topic.name,
        parent_id: topic.parent_id,
        weight: topic.weight,
        score: m.score,
        percentage: m.percentage,
        n_questions: m.n_questions,
        band: m.band,
        reason,
        missed_sections: m.missed_sections,
      });
    }

    // Calculate overall readiness score across assessed topics
    const assessed = diagnosedTopics.filter((t) => t.band !== "unassessed");
    const overallScore =
      assessed.length > 0
        ? Math.round(
            (assessed.reduce((sum, t) => sum + t.score, 0) / assessed.length) * 100
          )
        : 0;

    return NextResponse.json({
      attemptId,
      topics: diagnosedTopics,
      evidence: evidenceList,
      overallScore,
      totalAssessed: assessed.length,
      weakCount: diagnosedTopics.filter((t) => t.band === "weak").length,
      mediumCount: diagnosedTopics.filter((t) => t.band === "medium").length,
      strongCount: diagnosedTopics.filter((t) => t.band === "strong").length,
      unassessedCount: diagnosedTopics.filter((t) => t.band === "unassessed").length,
    });
  } catch (err: any) {
    console.error("Gaps endpoint error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
