import { MasteryBand, PlanItem } from "@/lib/types/database";

export interface TopicForPlanning {
  id: string;
  name: string;
  weight: number;
  score: number; // 0.0 to 1.0
  band: MasteryBand;
  n_questions: number;
  cited_sections: string[];
}

export interface SchedulerOptions {
  startDate?: string; // YYYY-MM-DD
  baseMinutes?: number; // default: 60
}

/**
 * Computes priority deterministically:
 * priority = topic.weight * (1 - mastery) * confidencePenalty (higher penalty for few questions)
 */
export function computeTopicPriority(topic: TopicForPlanning): number {
  const mastery = Math.max(0, Math.min(1.0, topic.score));
  const gap = 1 - mastery;

  let confidencePenalty = 1.0;
  if (topic.n_questions === 0) {
    confidencePenalty = 1.6; // High priority: unassessed blindspot
  } else if (topic.n_questions === 1) {
    confidencePenalty = 1.3;
  }

  // Boost weak band topics
  const bandMultiplier = topic.band === "weak" ? 1.4 : topic.band === "medium" ? 1.1 : 0.8;

  const rawPriority = (topic.weight || 1.0) * gap * confidencePenalty * bandMultiplier;
  return Number(rawPriority.toFixed(4));
}

/**
 * Computes minutes needed deterministically:
 * minutesNeeded = baseMinutes * (1 - mastery)
 */
export function computeMinutesNeeded(
  topic: TopicForPlanning,
  baseMinutes = 60
): number {
  if (topic.band === "unassessed") return 25; // Diagnostic task
  if (topic.band === "strong") return 20; // Short final review

  const mastery = Math.max(0, Math.min(1.0, topic.score));
  const rawMinutes = baseMinutes * (1 - mastery);
  // Round to nearest 5 minutes, bounded between 20 and 90 mins
  return Math.min(90, Math.max(20, Math.round(rawMinutes / 5) * 5));
}

/**
 * Generates an array of formatted YYYY-MM-DD dates between start and end date.
 */
export function getDaysBetween(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDateStr);
  const end = new Date(endDateStr);

  // If exam date is today or past, provide at least today + 3 days for review
  if (end <= current) {
    end.setDate(current.getDate() + 3);
  }

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Pure deterministic greedy scheduler:
 * - Fills each day up to minutes_per_day
 * - Working back from exam_date:
 *   - Weak topics scheduled first (read & practice)
 *   - Medium topics get initial slot + later revisit slot
 *   - Strong topics get a short final review close to exam_date
 *   - Unassessed topics get a diagnostic task on the earliest days
 */
export function scheduleRevisionPlan(
  topics: TopicForPlanning[],
  examDateStr: string,
  minutesPerDay: number,
  options: SchedulerOptions = {}
): PlanItem[] {
  if (!topics || topics.length === 0) return [];

  const today = new Date().toISOString().split("T")[0];
  const startDateStr = options.startDate || today;
  const baseMinutes = options.baseMinutes || 60;

  const availableDays = getDaysBetween(startDateStr, examDateStr);
  if (availableDays.length === 0) return [];

  // Track remaining daily capacity in minutes
  const dailyCapacity = new Map<string, number>();
  availableDays.forEach((day) => dailyCapacity.set(day, minutesPerDay));

  const planItems: PlanItem[] = [];

  // Sort topics by priority descending
  const prioritized = [...topics].sort((a, b) => computeTopicPriority(b) - computeTopicPriority(a));

  // 1. Unassessed topics: Diagnostic tasks on the earliest days
  const unassessed = prioritized.filter((t) => t.band === "unassessed");
  for (const topic of unassessed) {
    const mins = 25;
    // Find earliest day with capacity
    for (const day of availableDays) {
      const cap = dailyCapacity.get(day) || 0;
      if (cap >= mins) {
        planItems.push({
          id: `item-${topic.id}-diag-${day}`,
          date: day,
          topic_id: topic.id,
          topic_name: topic.name,
          task_type: "diagnostic",
          minutes: mins,
          cited_sections: topic.cited_sections.slice(0, 3),
          completed: false,
          description: `Complete diagnostic quiz for ${topic.name} to establish knowledge baseline.`,
        });
        dailyCapacity.set(day, cap - mins);
        break;
      }
    }
  }

  // 2. Strong topics: Short final review on the last 2 days before exam
  const strong = prioritized.filter((t) => t.band === "strong");
  const finalReviewDays = availableDays.slice(-2);
  for (const topic of strong) {
    const mins = 20;
    for (const day of finalReviewDays) {
      const cap = dailyCapacity.get(day) || 0;
      if (cap >= mins) {
        planItems.push({
          id: `item-${topic.id}-review-${day}`,
          date: day,
          topic_id: topic.id,
          topic_name: topic.name,
          task_type: "revisit",
          minutes: mins,
          cited_sections: topic.cited_sections.slice(0, 3),
          completed: false,
          description: `Rapid final review of ${topic.name} formulas and key points before exam.`,
        });
        dailyCapacity.set(day, cap - mins);
        break;
      }
    }
  }

  // 3. Weak & Medium topics: Fill remaining slots
  const gaps = prioritized.filter((t) => t.band === "weak" || t.band === "medium");
  for (const topic of gaps) {
    const totalMins = computeMinutesNeeded(topic, baseMinutes);
    const isWeak = topic.band === "weak";

    // Split into read (foundation) and practice sessions
    const session1Mins = Math.round(totalMins * (isWeak ? 0.6 : 0.5) / 5) * 5;
    const session2Mins = totalMins - session1Mins;

    // Schedule Session 1 (Read / Deep Concept)
    let session1Day: string | null = null;
    for (const day of availableDays) {
      const cap = dailyCapacity.get(day) || 0;
      if (cap >= session1Mins) {
        planItems.push({
          id: `item-${topic.id}-read-${day}`,
          date: day,
          topic_id: topic.id,
          topic_name: topic.name,
          task_type: "read",
          minutes: session1Mins,
          cited_sections: topic.cited_sections.slice(0, 3),
          completed: false,
          description: `Study core concepts in ${topic.name}. Focus on missed sections.`,
        });
        dailyCapacity.set(day, cap - session1Mins);
        session1Day = day;
        break;
      }
    }

    // Schedule Session 2 (Practice or Revisit)
    if (session2Mins > 0) {
      const taskType = isWeak ? "practice" : "revisit";
      // Pick a day after session 1 if possible
      const s1Idx = session1Day ? availableDays.indexOf(session1Day) : -1;
      const candidateDays = s1Idx >= 0 ? availableDays.slice(s1Idx + 1) : availableDays;

      for (const day of candidateDays.length > 0 ? candidateDays : availableDays) {
        const cap = dailyCapacity.get(day) || 0;
        if (cap >= session2Mins) {
          planItems.push({
            id: `item-${topic.id}-${taskType}-${day}`,
            date: day,
            topic_id: topic.id,
            topic_name: topic.name,
            task_type: taskType,
            minutes: session2Mins,
            cited_sections: topic.cited_sections.slice(0, 3),
            completed: false,
            description: `${taskType === "practice" ? "Solve diagnostic questions on" : "Revisit and test"} ${topic.name}.`,
          });
          dailyCapacity.set(day, cap - session2Mins);
          break;
        }
      }
    }
  }

  // Sort chronologically by date
  return planItems.sort((a, b) => a.date.localeCompare(b.date));
}
