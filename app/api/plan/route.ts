import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scheduleRevisionPlan, TopicForPlanning } from "@/lib/diagnosis/plan";
import { phrasePlanTasks } from "@/lib/ai/planTasks";
import { computeTopicMastery, rollupParentTopics, AnswerFact, TopicHierarchyNode } from "@/lib/diagnosis/mastery";
import { PlanItem } from "@/lib/types/database";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check for existing saved plan
    const { data: existingPlan } = await supabase
      .from("plans")
      .select("id, exam_date, minutes_per_day, items, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingPlan && existingPlan.items) {
      return NextResponse.json({
        plan: existingPlan,
        items: existingPlan.items,
        examDate: existingPlan.exam_date,
        minutesPerDay: existingPlan.minutes_per_day,
      });
    }

    // 2. If no plan exists, generate default plan
    const defaultExamDate = new Date();
    defaultExamDate.setDate(defaultExamDate.getDate() + 14);
    const examDateStr = defaultExamDate.toISOString().split("T")[0];
    const minutesPerDay = 60;

    const generated = await buildAndSavePlan(userId, examDateStr, minutesPerDay, supabase);
    return NextResponse.json(generated);
  } catch (err: any) {
    console.error("Plan GET error:", err);
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

    const { examDate, minutesPerDay = 60 } = await req.json();

    if (!examDate) {
      return NextResponse.json({ error: "examDate is required" }, { status: 400 });
    }

    const result = await buildAndSavePlan(userId, examDate, minutesPerDay, supabase);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Plan POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, completed } = await req.json();

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const { data: currentPlan } = await supabase
      .from("plans")
      .select("id, items")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!currentPlan) {
      return NextResponse.json({ error: "No plan found" }, { status: 404 });
    }

    const updatedItems = (currentPlan.items || []).map((it: PlanItem) =>
      it.id === itemId ? { ...it, completed: !!completed } : it
    );

    await supabase
      .from("plans")
      .update({ items: updatedItems })
      .eq("id", currentPlan.id)
      .eq("user_id", userId);

    return NextResponse.json({ success: true, items: updatedItems });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function buildAndSavePlan(
  userId: string,
  examDateStr: string,
  minutesPerDay: number,
  supabase: any
) {
  // Fetch user topics
  const { data: rawTopics } = await supabase
    .from("topics")
    .select("id, parent_id, name, weight")
    .eq("user_id", userId);

  const topics: TopicHierarchyNode[] = (rawTopics || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    parent_id: t.parent_id,
    weight: Number(t.weight || 1.0),
  }));

  // Fetch answers to compute mastery
  const { data: rawAnswers } = await supabase
    .from("answers")
    .select(
      "score, is_correct, questions(difficulty, topic_id, chunks(section_path))"
    )
    .eq("user_id", userId);

  const answerFacts: AnswerFact[] = (rawAnswers || [])
    .filter((a: any) => a.questions?.topic_id)
    .map((a: any) => ({
      topic_id: a.questions.topic_id,
      score: Number(a.score || (a.is_correct ? 1.0 : 0.0)),
      is_correct: a.is_correct,
      difficulty: (a.questions.difficulty || 1) as 1 | 2 | 3,
      attemptsAgo: 0,
      cited_section: a.questions.chunks?.section_path,
    }));

  const directMasteries = new Map();
  for (const t of topics) {
    directMasteries.set(t.id, computeTopicMastery(t.id, t.name, answerFacts));
  }
  const rolledMasteries = rollupParentTopics(directMasteries, topics);

  // Build topic list for planning
  const planningTopics: TopicForPlanning[] = topics.map((t) => {
    const m = rolledMasteries.get(t.id) || {
      score: 0,
      band: "unassessed",
      n_questions: 0,
      missed_sections: [],
    };
    return {
      id: t.id,
      name: t.name,
      weight: t.weight,
      score: m.score,
      band: m.band,
      n_questions: m.n_questions,
      cited_sections: m.missed_sections,
    };
  });

  // 1. Pure deterministic greedy scheduling
  const scheduledItems = scheduleRevisionPlan(planningTopics, examDateStr, minutesPerDay);

  // 2. LLM phrases task descriptions strictly for the chosen items
  const phrasedItems = await phrasePlanTasks(scheduledItems);

  // 3. Save to database
  const planId = crypto.randomUUID();
  await supabase.from("plans").insert({
    id: planId,
    user_id: userId,
    exam_date: examDateStr,
    minutes_per_day: minutesPerDay,
    items: phrasedItems,
  });

  return {
    planId,
    items: phrasedItems,
    examDate: examDateStr,
    minutesPerDay,
    totalDays: new Set(phrasedItems.map((i) => i.date)).size,
    totalMinutes: phrasedItems.reduce((sum, i) => sum + i.minutes, 0),
  };
}
