import { MasteryBand } from "@/lib/types/database";

export interface AnswerFact {
  topic_id: string;
  topic_name?: string;
  is_correct: boolean;
  score: number; // 0.0 to 1.0
  difficulty: 1 | 2 | 3;
  attemptsAgo: number; // 0 = current attempt, 1 = previous, etc.
  stem?: string;
  cited_section?: string;
  page?: number;
}

export interface TopicMasteryComputation {
  topic_id: string;
  topic_name: string;
  score: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  n_questions: number;
  band: MasteryBand;
  missed_sections: string[];
  missed_stems: string[];
}

export interface TopicHierarchyNode {
  id: string;
  name: string;
  parent_id: string | null;
  weight: number;
}

/**
 * Returns difficulty weight: 1.0 for difficulty 1, 1.5 for difficulty 2, 2.0 for difficulty 3.
 */
export function getDifficultyWeight(difficulty: 1 | 2 | 3): number {
  switch (difficulty) {
    case 1:
      return 1.0;
    case 2:
      return 1.5;
    case 3:
      return 2.0;
    default:
      return 1.0;
  }
}

/**
 * Returns recency weight: 0.8^attemptsAgo (newer attempts weigh more).
 */
export function getRecencyWeight(attemptsAgo: number): number {
  return Math.pow(0.8, Math.max(0, attemptsAgo));
}

/**
 * Computes deterministic band from question count and mastery score.
 * n < 2 -> "unassessed"; mastery < 0.5 -> "weak"; < 0.75 -> "medium"; else "strong".
 */
export function computeBand(n_questions: number, score: number): MasteryBand {
  if (n_questions < 2) return "unassessed";
  if (score < 0.5) return "weak";
  if (score < 0.75) return "medium";
  return "strong";
}

/**
 * Computes deterministic mastery score and band for a single topic.
 * Formula: sum(score_i * difficultyWeight_i * recencyWeight_i) / sum(difficultyWeight_i * recencyWeight_i)
 */
export function computeTopicMastery(
  topicId: string,
  topicName: string,
  answers: AnswerFact[]
): TopicMasteryComputation {
  const topicAnswers = answers.filter((a) => a.topic_id === topicId);
  const n_questions = topicAnswers.length;

  if (n_questions === 0) {
    return {
      topic_id: topicId,
      topic_name: topicName,
      score: 0,
      percentage: 0,
      n_questions: 0,
      band: "unassessed",
      missed_sections: [],
      missed_stems: [],
    };
  }

  let weightedSum = 0;
  let totalWeights = 0;
  const missedSections = new Set<string>();
  const missedStems: string[] = [];

  for (const ans of topicAnswers) {
    const diffW = getDifficultyWeight(ans.difficulty);
    const recW = getRecencyWeight(ans.attemptsAgo);
    const weight = diffW * recW;

    weightedSum += (ans.score ?? (ans.is_correct ? 1.0 : 0.0)) * weight;
    totalWeights += weight;

    if (!ans.is_correct || ans.score < 0.7) {
      if (ans.cited_section) missedSections.add(ans.cited_section);
      if (ans.stem) missedStems.push(ans.stem);
    }
  }

  const rawScore = totalWeights > 0 ? weightedSum / totalWeights : 0;
  const score = Number(Math.max(0, Math.min(1.0, rawScore)).toFixed(3));
  const band = computeBand(n_questions, score);

  return {
    topic_id: topicId,
    topic_name: topicName,
    score,
    percentage: Math.round(score * 100),
    n_questions,
    band,
    missed_sections: Array.from(missedSections),
    missed_stems: missedStems,
  };
}

/**
 * Rolls up child topic masteries to parents using weighted averages.
 */
export function rollupParentTopics(
  directMasteries: Map<string, TopicMasteryComputation>,
  topics: TopicHierarchyNode[]
): Map<string, TopicMasteryComputation> {
  const result = new Map<string, TopicMasteryComputation>(directMasteries);

  // Group child topics by parent
  const parentToChildren = new Map<string, TopicHierarchyNode[]>();
  for (const t of topics) {
    if (t.parent_id) {
      const list = parentToChildren.get(t.parent_id) || [];
      list.push(t);
      parentToChildren.set(t.parent_id, list);
    }
  }

  // Calculate parent roll-up
  for (const topic of topics) {
    if (topic.parent_id) continue; // Focus on parent topics

    const children = parentToChildren.get(topic.id);
    if (!children || children.length === 0) continue;

    let totalWeight = 0;
    let weightedScoreSum = 0;
    let totalQuestions = 0;
    const allMissedSections = new Set<string>();
    const allMissedStems: string[] = [];

    // Include parent's direct answers if any
    const directParent = directMasteries.get(topic.id);
    if (directParent && directParent.n_questions > 0) {
      const pWeight = topic.weight || 1.0;
      weightedScoreSum += directParent.score * pWeight;
      totalWeight += pWeight;
      totalQuestions += directParent.n_questions;
      directParent.missed_sections.forEach((s) => allMissedSections.add(s));
      allMissedStems.push(...directParent.missed_stems);
    }

    // Roll up children
    for (const child of children) {
      const childMastery = directMasteries.get(child.id);
      if (childMastery && childMastery.n_questions > 0) {
        const cWeight = child.weight || 1.0;
        weightedScoreSum += childMastery.score * cWeight;
        totalWeight += cWeight;
        totalQuestions += childMastery.n_questions;
        childMastery.missed_sections.forEach((s) => allMissedSections.add(s));
        allMissedStems.push(...childMastery.missed_stems);
      }
    }

    if (totalWeight > 0) {
      const rolledScore = Number((weightedScoreSum / totalWeight).toFixed(3));
      const rolledBand = computeBand(totalQuestions, rolledScore);

      result.set(topic.id, {
        topic_id: topic.id,
        topic_name: topic.name,
        score: rolledScore,
        percentage: Math.round(rolledScore * 100),
        n_questions: totalQuestions,
        band: rolledBand,
        missed_sections: Array.from(allMissedSections),
        missed_stems: allMissedStems,
      });
    }
  }

  return result;
}
