import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

/**
 * Returns the configured swappable LanguageModel instance.
 * Defaults to Google Gemini (gemini-1.5-pro or gemini-1.5-flash / gemini-2.0-flash),
 * supports OpenAI (gpt-4o-mini / gpt-4o).
 */
export function getLLMModel(): LanguageModel {
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

  if (provider === "openai") {
    return openai("gpt-4o-mini");
  }

  // Default: Gemini 1.5 Pro or Flash
  return google("gemini-1.5-flash");
}
