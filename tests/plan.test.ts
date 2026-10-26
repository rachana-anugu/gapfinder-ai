import { describe, it, expect } from "vitest";
import {
  computeTopicPriority,
  computeMinutesNeeded,
  scheduleRevisionPlan,
  TopicForPlanning,
} from "@/lib/diagnosis/plan";

describe("Deterministic Revision Plan Scheduler (lib/diagnosis/plan.ts)", () => {
  it("computes priority giving higher weight to gaps and unassessed topics", () => {
    const weakTopic: TopicForPlanning = {
      id: "t1",
      name: "Deadlocks",
      weight: 2.0,
      score: 0.2, // 80% gap
      band: "weak",
      n_questions: 3,
      cited_sections: ["Ch3"],
    };

    const strongTopic: TopicForPlanning = {
      id: "t2",
      name: "File Systems",
      weight: 1.0,
      score: 0.9, // 10% gap
      band: "strong",
      n_questions: 4,
      cited_sections: [],
    };

    const unassessedTopic: TopicForPlanning = {
      id: "t3",
      name: "Memory Management",
      weight: 2.0,
      score: 0.0,
      band: "unassessed",
      n_questions: 0,
      cited_sections: [],
    };

    const pWeak = computeTopicPriority(weakTopic);
    const pStrong = computeTopicPriority(strongTopic);
    const pUnassessed = computeTopicPriority(unassessedTopic);

    expect(pWeak).toBeGreaterThan(pStrong);
    expect(pUnassessed).toBeGreaterThan(pStrong);
  });

  it("calculates minutes needed proportional to knowledge gap", () => {
    const weakTopic: TopicForPlanning = {
      id: "t1",
      name: "Deadlocks",
      weight: 2.0,
      score: 0.2,
      band: "weak",
      n_questions: 3,
      cited_sections: [],
    };

    const strongTopic: TopicForPlanning = {
      id: "t2",
      name: "File Systems",
      weight: 1.0,
      score: 0.95,
      band: "strong",
      n_questions: 4,
      cited_sections: [],
    };

    const minsWeak = computeMinutesNeeded(weakTopic, 60);
    const minsStrong = computeMinutesNeeded(strongTopic, 60);

    expect(minsWeak).toBeGreaterThan(minsStrong);
    expect(minsStrong).toBe(20); // Short final review floor
  });

  it("schedules tasks within daily capacity working toward exam date", () => {
    const topics: TopicForPlanning[] = [
      {
        id: "t1",
        name: "Deadlocks",
        weight: 2.0,
        score: 0.2,
        band: "weak",
        n_questions: 3,
        cited_sections: ["Deadlock Detection", "Resource Graphs"],
      },
      {
        id: "t2",
        name: "Paging",
        weight: 1.0,
        score: 0.6,
        band: "medium",
        n_questions: 2,
        cited_sections: ["Page Tables"],
      },
      {
        id: "t3",
        name: "Storage",
        weight: 1.0,
        score: 0.0,
        band: "unassessed",
        n_questions: 0,
        cited_sections: [],
      },
      {
        id: "t4",
        name: "Threads",
        weight: 1.0,
        score: 0.9,
        band: "strong",
        n_questions: 4,
        cited_sections: [],
      },
    ];

    const today = new Date();
    const examDate = new Date();
    examDate.setDate(today.getDate() + 7);
    const examDateStr = examDate.toISOString().split("T")[0];

    const items = scheduleRevisionPlan(topics, examDateStr, 60, {
      startDate: today.toISOString().split("T")[0],
    });

    expect(items.length).toBeGreaterThan(0);

    // Verify task types generated
    const taskTypes = items.map((i) => i.task_type);
    expect(taskTypes).toContain("diagnostic"); // Storage
    expect(taskTypes).toContain("read"); // Deadlocks
    expect(taskTypes).toContain("revisit"); // Threads / Paging

    // Verify total minutes per day does not exceed daily budget
    const dayTotals = new Map<string, number>();
    items.forEach((it) => {
      dayTotals.set(it.date, (dayTotals.get(it.date) || 0) + it.minutes);
    });

    for (const [, total] of dayTotals.entries()) {
      expect(total).toBeLessThanOrEqual(60);
    }
  });
});
