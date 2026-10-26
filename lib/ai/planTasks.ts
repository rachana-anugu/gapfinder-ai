import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";
import { PlanItem } from "@/lib/types/database";

export const TaskPhrasingSchema = z.object({
  phrasings: z.array(
    z.object({
      id: z.string().describe("Matches the plan item id"),
      description: z
        .string()
        .describe("Concise 1-sentence actionable instruction tailored to the task type and cited sections"),
    })
  ),
});

/**
 * Deterministic fallback task phraser.
 */
export function fallbackPhraseTasks(items: PlanItem[]): PlanItem[] {
  return items.map((item) => {
    let desc = item.description || "";
    const sectionsText = item.cited_sections.length > 0 ? ` (${item.cited_sections.join(", ")})` : "";

    switch (item.task_type) {
      case "read":
        desc = `Study core explanations and notes for ${item.topic_name}${sectionsText}.`;
        break;
      case "practice":
        desc = `Work through practice questions on ${item.topic_name}${sectionsText} to solidify application.`;
        break;
      case "revisit":
        desc = `Rapid review of ${item.topic_name}${sectionsText} to reinforce memory retention.`;
        break;
      case "diagnostic":
        desc = `Complete a diagnostic quiz on ${item.topic_name} to calibrate baseline knowledge.`;
        break;
    }

    return { ...item, description: desc };
  });
}

/**
 * Phrases task descriptions strictly for items the deterministic scheduler already decided.
 * The LLM CANNOT alter dates, minutes, task types, or topic allocations.
 */
export async function phrasePlanTasks(items: PlanItem[]): Promise<PlanItem[]> {
  if (items.length === 0) return [];

  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackPhraseTasks(items);
  }

  const itemsPrompt = items
    .map(
      (it) =>
        `- ID: "${it.id}", Topic: "${it.topic_name}", TaskType: "${it.task_type}", Minutes: ${it.minutes}, Sections: [${it.cited_sections.join(", ")}]`
    )
    .join("\n");

  const prompt = `You are an academic study planner. Write a concise, 1-sentence actionable instruction for each scheduled task item below.
Rules:
1. Mention the topic and cited sections where relevant.
2. Match the specific task type:
   - "read": active reading and comprehension of concepts.
   - "practice": problem-solving or answering quiz questions.
   - "revisit": spaced repetition / summary check.
   - "diagnostic": assessing initial knowledge baseline.
3. Do NOT change IDs or invent new tasks.

Scheduled Tasks:
${itemsPrompt}
`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: TaskPhrasingSchema,
      prompt,
      temperature: 0.2,
    });

    const descMap = new Map<string, string>();
    object.phrasings.forEach((p) => descMap.set(p.id, p.description));

    return items.map((it) => ({
      ...it,
      description: descMap.get(it.id) || it.description || `Study ${it.topic_name}`,
    }));
  } catch (err) {
    console.warn("Task phrasing LLM call failed, falling back to deterministic text:", err);
    return fallbackPhraseTasks(items);
  }
}
