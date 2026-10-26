import { z } from "zod";
import { generateObject } from "ai";
import { getLLMModel } from "./model";

export interface SubtopicDefinition {
  name: string;
  description: string;
  weight: number;
}

export interface TopicDefinition {
  name: string;
  description: string;
  weight: number;
  subtopics?: SubtopicDefinition[];
}

export interface TopicMapResult {
  subject: string;
  topics: TopicDefinition[];
}

export const TopicDefinitionSchema = z.object({
  name: z.string().describe("Clear, concise topic or unit name, e.g., 'Process Synchronization'"),
  description: z.string().describe("1-2 sentence description of key concepts covered in this topic"),
  weight: z.number().min(0.5).max(10).describe("Weight or importance based on marks/exam distribution (default: 1.0 - 5.0)"),
  subtopics: z.array(
    z.object({
      name: z.string().describe("Subtopic or module name"),
      description: z.string().describe("Brief description of subtopic"),
      weight: z.number().min(0.5).max(10).default(1.0),
    })
  ).default([]),
});

export const TopicTreeSchema = z.object({
  subject: z.string().describe("Identified subject or course title"),
  topics: z.array(TopicDefinitionSchema).describe("Structured tree of topics and subtopics"),
});

/**
 * Deterministic fallback parser to extract topics from syllabus headings
 * when offline or when API keys are not provided.
 */
export function fallbackTopicTree(syllabusText: string): TopicMapResult {
  const lines = syllabusText.split("\n");
  const topics: TopicDefinition[] = [];
  let currentTopic: TopicDefinition | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect unit / chapter / module header
    const unitMatch = line.match(/^(?:unit|chapter|module|part)\s+(\d+|[ivxlcdm]+)[:.\s]+(.*)/i)
      || line.match(/^#{1,2}\s+(.*)/);

    if (unitMatch) {
      if (currentTopic) topics.push(currentTopic);
      const title = (unitMatch[2] || unitMatch[1] || line).replace(/^[#\s]+/, "").trim();
      currentTopic = {
        name: title,
        description: `Covers foundational principles and core requirements for ${title}.`,
        weight: 2.0,
        subtopics: [],
      };
      continue;
    }

    // Detect subtopic (bullet or numbered 1.1)
    const subMatch = line.match(/^(?:[-*•]|\d+\.\d+)\s+(.*)/);
    if (subMatch && currentTopic) {
      const subTitle = subMatch[1].trim();
      if (subTitle.length > 3 && subTitle.length < 80) {
        currentTopic.subtopics = currentTopic.subtopics || [];
        currentTopic.subtopics.push({
          name: subTitle,
          description: `Key sub-concept within ${currentTopic.name}.`,
          weight: 1.0,
        });
      }
    }
  }

  if (currentTopic) topics.push(currentTopic);

  // If no structured topics found, supply reasonable defaults from text
  if (topics.length === 0) {
    topics.push({
      name: "Core Fundamentals",
      description: "Foundational syllabus concepts and primary objectives.",
      weight: 1.0,
      subtopics: [
        { name: "Overview & Definitions", description: "Fundamental terminology and scope", weight: 1.0 },
        { name: "Core Principles", description: "Mechanisms, algorithms and application", weight: 1.0 },
      ],
    });
  }

  return {
    subject: "Course Syllabus",
    topics,
  };
}

/**
 * Extracts a structured topic tree from syllabus text, incorporating marks
 * or past paper frequency if provided.
 */
export async function generateTopicMap(
  syllabusText: string,
  pastPaperText?: string
): Promise<TopicMapResult> {
  const apiKey =
    process.env.LLM_PROVIDER === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey || apiKey.startsWith("mock-") || apiKey.startsWith("your-")) {
    return fallbackTopicTree(syllabusText);
  }

  const prompt = `You are an expert curriculum architect. Analyze the provided course syllabus text (and optional past paper questions/marks) to construct an accurate, non-overlapping hierarchical topic tree.
Extract:
1. The subject name.
2. The main units/topics with a 1-2 sentence description and an estimated weight (1.0 to 5.0, reflecting marks, exam prominence, or depth).
3. The key subtopics for each topic.

Syllabus Content:
"""
${syllabusText.slice(0, 15000)}
"""

${pastPaperText ? `Past Exam Paper Context (to calibrate topic weights and focus areas):\n"""\n${pastPaperText.slice(0, 6000)}\n"""` : ""}
`;

  try {
    const { object } = await generateObject({
      model: getLLMModel(),
      schema: TopicTreeSchema,
      prompt,
      temperature: 0.2,
    });

    return object;
  } catch (error) {
    console.warn("LLM topic map generation failed; falling back to deterministic extraction:", error);
    return fallbackTopicTree(syllabusText);
  }
}
