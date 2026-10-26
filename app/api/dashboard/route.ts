import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch counts
    const { count: docCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: chunkCount } = await supabase
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: topicCount } = await supabase
      .from("topics")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // 2. Fetch attempts
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    // 3. Fetch topic mastery history across attempts
    const { data: masteryHistory } = await supabase
      .from("topic_mastery")
      .select("attempt_id, topic_id, score, band, created_at, topics(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    // Transform into recharts data series
    // { attempt: "Quiz 1", "Process Synchronization": 35, "Memory Management": 70, ... }
    const trendMap = new Map<string, any>();
    const allTopicNames = new Set<string>();

    if (masteryHistory && masteryHistory.length > 0) {
      masteryHistory.forEach((m: any, idx: number) => {
        const attId = m.attempt_id;
        const topicName = m.topics?.name || "Topic";
        allTopicNames.add(topicName);

        if (!trendMap.has(attId)) {
          trendMap.set(attId, {
            attemptLabel: `Quiz ${trendMap.size + 1}`,
            date: m.created_at.split("T")[0],
          });
        }

        const entry = trendMap.get(attId);
        entry[topicName] = Math.round(Number(m.score || 0) * 100);
      });
    }

    const trendData = Array.from(trendMap.values());

    // 4. Fetch latest topic bands
    const { data: latestMasteries } = await supabase
      .from("topic_mastery")
      .select("topic_id, score, band, reason, topics(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Deduplicate to latest score per topic
    const latestByTopic = new Map<string, any>();
    (latestMasteries || []).forEach((m: any) => {
      if (!latestByTopic.has(m.topic_id)) {
        latestByTopic.set(m.topic_id, {
          topicId: m.topic_id,
          name: m.topics?.name || "Topic",
          score: Number(m.score || 0),
          percentage: Math.round(Number(m.score || 0) * 100),
          band: m.band,
          reason: m.reason,
        });
      }
    });

    const topicBands = Array.from(latestByTopic.values());
    const weakTopics = topicBands.filter((t) => t.band === "weak");
    const mediumTopics = topicBands.filter((t) => t.band === "medium");
    const strongTopics = topicBands.filter((t) => t.band === "strong");

    const overallScore =
      topicBands.length > 0
        ? Math.round(
            (topicBands.reduce((sum, t) => sum + t.percentage, 0) / topicBands.length)
          )
        : 0;

    // 5. Next recommended action
    let nextAction = {
      title: "Take a Diagnostic Quiz",
      description: "Assess your baseline knowledge to map initial gaps.",
      actionLink: "/quiz",
      actionText: "Start Diagnostic Quiz",
      badge: "Diagnostic",
    };

    if (weakTopics.length > 0) {
      const highestGap = weakTopics.sort((a, b) => a.score - b.score)[0];
      nextAction = {
        title: `Revise ${highestGap.name}`,
        description: highestGap.reason || `Diagnosed as Weak (${highestGap.percentage}%). Targeted review recommended.`,
        actionLink: `/assistant?topic=${encodeURIComponent(highestGap.name)}`,
        actionText: "Study with AI Assistant",
        badge: "Critical Gap",
      };
    } else if (mediumTopics.length > 0) {
      const med = mediumTopics[0];
      nextAction = {
        title: `Solidify ${med.name}`,
        description: `Current mastery is ${med.percentage}%. Practice advanced questions to push into Strong band.`,
        actionLink: "/quiz",
        actionText: "Practice Topic",
        badge: "Solidify Knowledge",
      };
    } else if (topicBands.length > 0) {
      nextAction = {
        title: "Maintain Exam Readiness",
        description: "All assessed topics are in the Strong band. Review revision plan tasks.",
        actionLink: "/plan",
        actionText: "View Revision Plan",
        badge: "On Track",
      };
    }

    return NextResponse.json({
      stats: {
        documents: docCount || 0,
        chunks: chunkCount || 0,
        topics: topicCount || 0,
        attempts: attempts?.length || 0,
        overallScore,
        weakCount: weakTopics.length,
        mediumCount: mediumTopics.length,
        strongCount: strongTopics.length,
      },
      nextAction,
      trendData,
      topicNames: Array.from(allTopicNames).slice(0, 5), // top 5 for chart clarity
      recentTopics: topicBands.slice(0, 6),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
