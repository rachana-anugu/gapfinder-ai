import { extractText } from "unpdf";

export interface ParsedPage {
  page: number;
  text: string;
}

/**
 * Extracts text per page from PDF, Markdown, or Plain Text files.
 * Preserves page numbering for faithful citations.
 */
export async function parseDocument(
  fileBuffer: Buffer | ArrayBuffer,
  fileName: string
): Promise<ParsedPage[]> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    const uint8 = fileBuffer instanceof Uint8Array
      ? fileBuffer
      : new Uint8Array(fileBuffer);

    const { text, totalPages } = await extractText(uint8);

    if (Array.isArray(text)) {
      return text.map((pageText, index) => ({
        page: index + 1,
        text: pageText.trim(),
      })).filter(p => p.text.length > 0);
    }

    // If single string returned or text per page split
    const pages = (typeof text === "string" ? text : "")
      .split(/\f|\n\s*\n\s*---\s*Page\s+\d+\s*---\s*\n/gi)
      .map((p, idx) => ({ page: idx + 1, text: p.trim() }))
      .filter(p => p.text.length > 0);

    if (pages.length === 0) {
      return [{ page: 1, text: String(text).trim() }];
    }
    return pages;
  }

  // Handle Markdown or Plain Text
  const rawText = Buffer.isBuffer(fileBuffer)
    ? fileBuffer.toString("utf-8")
    : new TextDecoder("utf-8").decode(fileBuffer);

  // If text contains form feed (\f) or page break markers
  const rawPages = rawText.split(/\f|<!-- pagebreak -->|===Page \d+===/i);
  if (rawPages.length > 1) {
    return rawPages.map((t, idx) => ({
      page: idx + 1,
      text: t.trim(),
    })).filter(p => p.text.length > 0);
  }

  // Single page document
  return [{ page: 1, text: rawText.trim() }];
}
