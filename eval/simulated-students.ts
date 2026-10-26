import { computeTopicMastery, AnswerFact } from "../lib/diagnosis/mastery";

export interface SimulationResult {
  numSimulatedStudents: number;
  totalTrueWeakTopics: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export function runStudentSimulations(numStudents = 50): SimulationResult {
  const allTopics = [
    { id: "t-deadlocks", name: "Deadlocks" },
    { id: "t-memory", name: "Memory Management" },
    { id: "t-cpu", name: "CPU Scheduling" },
    { id: "t-files", name: "File Systems" },
    { id: "t-sync", name: "Process Synchronization" },
  ];

  let totalTrueWeak = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (let s = 0; s < numStudents; s++) {
    // Pick 1 or 2 true weak topics for this student
    const weakTopicIndex = s % allTopics.length;
    const secondWeakIndex = (s + 2) % allTopics.length;
    const trueWeakTopicIds = new Set([allTopics[weakTopicIndex].id, allTopics[secondWeakIndex].id]);
    totalTrueWeak += trueWeakTopicIds.size;

    // Simulate 20 questions (4 per topic) across difficulties 1, 2, 3
    const answers: AnswerFact[] = [];
    for (const topic of allTopics) {
      const isWeak = trueWeakTopicIds.has(topic.id);
      const errorRate = isWeak ? 0.80 : 0.15; // 80% wrong on weak, 15% elsewhere

      for (let q = 0; q < 4; q++) {
        const difficulty = ((q % 3) + 1) as 1 | 2 | 3;
        // Pseudo-random deterministic roll based on student seed
        const roll = ((s * 31 + q * 17 + topic.id.charCodeAt(2)) % 100) / 100;
        const isCorrect = roll >= errorRate;
        const score = isCorrect ? 1.0 : 0.0;

        answers.push({
          topic_id: topic.id,
          topic_name: topic.name,
          is_correct: isCorrect,
          score,
          difficulty,
          attemptsAgo: 0,
        });
      }
    }

    // Run deterministic diagnosis
    const diagnosedWeakTopics = new Set<string>();
    for (const topic of allTopics) {
      const m = computeTopicMastery(topic.id, topic.name, answers);
      if (m.band === "weak") {
        diagnosedWeakTopics.add(topic.id);
      }
    }

    // Compare diagnosed weak topics against true weak topics
    for (const id of diagnosedWeakTopics) {
      if (trueWeakTopicIds.has(id)) {
        truePositives++;
      } else {
        falsePositives++;
      }
    }

    for (const id of trueWeakTopicIds) {
      if (!diagnosedWeakTopics.has(id)) {
        falseNegatives++;
      }
    }
  }

  const precision = truePositives / (truePositives + falsePositives || 1);
  const recall = truePositives / (truePositives + falseNegatives || 1);
  const f1Score = (2 * precision * recall) / (precision + recall || 1);

  return {
    numSimulatedStudents: numStudents,
    totalTrueWeakTopics: totalTrueWeak,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: Number((precision * 100).toFixed(1)),
    recall: Number((recall * 100).toFixed(1)),
    f1Score: Number((f1Score * 100).toFixed(1)),
  };
}

if (process.argv[1]?.includes("simulated-students")) {
  console.log("=== GapFinder Simulated Student Diagnostics Evaluation ===");
  const res = runStudentSimulations(50);
  console.table(res);
}
