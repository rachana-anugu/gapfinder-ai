import { ParsedPage } from "./parse";

export interface DocumentChunk {
  section_path: string;
  page: number;
  content: string;
}

interface HeadingItem {
  level: number;
  title: string;
}

/**
 * Splits text documents by headings first, then applies windowed chunking
 * (~400-600 tokens with ~80 overlap), recording the section_path and page number.
 */
export function chunkPages(pages: ParsedPage[], defaultTitle = "Document"): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const headingStack: HeadingItem[] = [];

  // Match markdown (# H1, ## H2) or numbered chapters (Chapter 1, Unit 2, 1.2 Title)
  const headingRegex = /^(#{1,6}\s+(.+)|(?:chapter|unit|section|part)\s+\d+[:.\s]+.*|\d+(?:\.\d+)*\s+[A-Z].*)$/i;

  for (const page of pages) {
    const lines = page.text.split("\n");
    let currentSectionContent: string[] = [];

    const flushCurrentSection = () => {
      const sectionText = currentSectionContent.join("\n").trim();
      if (!sectionText) return;

      const path = headingStack.length > 0
        ? headingStack.map(h => h.title).join(" > ")
        : defaultTitle;

      const subChunks = splitIntoTokenWindows(sectionText, 500, 80);
      for (const sc of subChunks) {
        if (sc.trim().length > 20) {
          chunks.push({
            section_path: path,
            page: page.page,
            content: sc.trim(),
          });
        }
      }
      currentSectionContent = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        currentSectionContent.push("");
        continue;
      }

      if (headingRegex.test(line)) {
        // Detect heading level
        let level = 1;
        let title = line;

        if (line.startsWith("#")) {
          const match = line.match(/^(#{1,6})\s+(.+)$/);
          if (match) {
            level = match[1].length;
            title = match[2].trim();
          }
        } else if (/^(?:chapter|unit|part)\b/i.test(line)) {
          level = 1;
        } else if (/^(?:section)\b/i.test(line)) {
          level = 2;
        } else {
          const dotCount = (line.match(/^\d+(\.\d+)*/)?.[0]?.match(/\./g) || []).length;
          level = dotCount + 1;
        }

        // Flush existing section before advancing heading
        flushCurrentSection();

        // Update heading stack
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }
        headingStack.push({ level, title });
      } else {
        currentSectionContent.push(line);
      }
    }

    flushCurrentSection();
  }

  // If entire document yielded no chunks (e.g. empty), return single chunk if there's any text
  if (chunks.length === 0) {
    const fullText = pages.map(p => p.text).join("\n\n").trim();
    if (fullText) {
      chunks.push({
        section_path: defaultTitle,
        page: 1,
        content: fullText.slice(0, 2500),
      });
    }
  }

  return chunks;
}

/**
 * Token-approximated window splitter.
 * Average English token is ~4 chars (or ~0.75 words).
 * targetTokens: ~500 tokens (~375 words)
 * overlapTokens: ~80 tokens (~60 words)
 */
function splitIntoTokenWindows(text: string, targetTokens = 500, overlapTokens = 80): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const targetWords = Math.round(targetTokens * 0.75);
  const overlapWords = Math.round(overlapTokens * 0.75);

  if (words.length <= targetWords) {
    return [text];
  }

  const result: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + targetWords, words.length);
    const windowWords = words.slice(startIndex, endIndex);
    result.push(windowWords.join(" "));

    if (endIndex >= words.length) break;
    startIndex += targetWords - overlapWords;
  }

  return result;
}
