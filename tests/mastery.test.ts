import { describe, it, expect } from "vitest";
import {
  computeTopicMastery,
  computeBand,
  getDifficultyWeight,
  getRecencyWeight,
  rollupParentTopics,
  AnswerFact,
  TopicHierarchyNode,
  TopicMasteryComputation,
} from "@/lib/diagnosis/mastery";

describe("Deterministic Mastery & Banding (lib/diagnosis/mastery.ts)", () => {
  it("enforces difficulty weights (1.0 for diff 1, 1.5 for diff 2, 2.0 for diff 3)", () => {
    expect(getDifficultyWeight(1)).toBe(1.0);
    expect(getDifficultyWeight(2)).toBe(1.5);
    expect(getDifficultyWeight(3)).toBe(2.0);
  });

  it("enforces recency exponential decay (0.8^attemptsAgo)", () => {
    expect(getRecencyWeight(0)).toBe(1.0);
    expect(getRecencyWeight(1)).toBeCloseTo(0.8);
    expect(getRecencyWeight(2)).toBeCloseTo(0.64);
  });

  it("computes exact bands: n < 2 is unassessed, < 0.5 is weak, < 0.75 is medium, >= 0.75 is strong", () => {
    expect(computeBand(0, 0.9)).toBe("unassessed");
    expect(computeBand(1, 1.0)).toBe("unassessed");
    expect(computeBand(2, 0.49)).toBe("weak");
    expect(computeBand(3, 0.50)).toBe("medium");
    expect(computeBand(4, 0.74)).toBe("medium");
    expect(computeBand(5, 0.75)).toBe("strong");
    expect(computeBand(2, 1.0)).toBe("strong");
  });

  it("computes weighted mastery with difficulty and recency decay correctly", () => {
    const answers: AnswerFact[] = [
      // Current attempt (attemptsAgo = 0): difficulty 3 (weight 2.0 * 1.0 = 2.0), score 1.0 -> 2.0
      {
        topic_id: "topic-1",
        is_correct: true,
        score: 1.0,
        difficulty: 3,
        attemptsAgo: 0,
      },
      // Previous attempt (attemptsAgo = 1): difficulty 1 (weight 1.0 * 0.8 = 0.8), score 0.0 -> 0.0
      {
        topic_id: "topic-1",
        is_correct: false,
        score: 0.0,
        difficulty: 1,
        attemptsAgo: 1,
      },
    ];

    // Total weights = 2.0 + 0.8 = 2.8
    // Weighted sum = 2.0 + 0.0 = 2.0
    // Expected score = 2.0 / 2.8 ≈ 0.714 -> "medium"
    const result = computeTopicMastery("topic-1", "Deadlocks", answers);
    expect(result.score).toBeCloseTo(0.714, 2);
    expect(result.band).toBe("medium");
    expect(result.n_questions).toBe(2);
  });

  it("rolls up child topic masteries to parents using weighted averages", () => {
    const topics: TopicHierarchyNode[] = [
      { id: "parent-1", name: "Process Management", parent_id: null, weight: 3.0 },
      { id: "child-1", name: "Deadlocks", parent_id: "parent-1", weight: 2.0 },
      { id: "child-2", name: "CPU Scheduling", parent_id: "parent-1", weight: 1.0 },
    ];

    const directMasteries = new Map<string, TopicMasteryComputation>([
      [
        "child-1",
        {
          topic_id: "child-1",
          topic_name: "Deadlocks",
          score: 0.4, // Weak
          percentage: 40,
          n_questions: 3,
          band: "weak",
          missed_sections: ["Ch3 > Detection"],
          missed_stems: [],
        },
      ],
      [
        "child-2",
        {
          topic_id: "child-2",
          topic_name: "CPU Scheduling",
          score: 1.0, // Strong
          percentage: 100,
          n_questions: 3,
          band: "strong",
          missed_sections: [],
          missed_stems: [],
        },
      ],
    ]);

    // Parent weighted score = (0.4 * 2.0 + 1.0 * 1.0) / (2.0 + 1.0) = (0.8 + 1.0) / 3.0 = 1.8 / 3.0 = 0.60 -> "medium"
    const rolled = rollupParentTopics(directMasteries, topics);
    const parentMastery = rolled.get("parent-1");

    expect(parentMastery).toBeDefined();
    expect(parentMastery?.score).toBeCloseTo(0.6, 2);
    expect(parentMastery?.band).toBe("medium");
    expect(parentMastery?.n_questions).toBe(6);
    expect(parentMastery?.missed_sections).toContain("Ch3 > Detection");
  });
});
