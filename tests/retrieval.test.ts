import { describe, it, expect } from "vitest";
import {
  reciprocalRankFusion,
  formatCitation,
  RetrievedChunk,
} from "@/lib/rag/retrieve";
import { explainTopic } from "@/lib/ai/explain";

describe("RAG Retrieval & Citation Validation (lib/rag/retrieve.ts)", () => {
  it("formats citations faithfully as 'Section path, p. N'", () => {
    expect(formatCitation("Ch3 > Deadlocks > Detection", 14)).toBe(
      "Ch3 > Deadlocks > Detection, p. 14"
    );
  });

  it("merges rankings with Reciprocal Rank Fusion", () => {
    const listA = [{ id: "chunk-1" }, { id: "chunk-2" }, { id: "chunk-3" }];
    const listB = [{ id: "chunk-2" }, { id: "chunk-1" }, { id: "chunk-4" }];

    const fused = reciprocalRankFusion([listA, listB], 60);

    // chunk-1 and chunk-2 appeared at top of both rankings
    expect(fused.length).toBe(4);
    const topIds = fused.slice(0, 2).map((f) => f.item.id);
    expect(topIds).toContain("chunk-1");
    expect(topIds).toContain("chunk-2");
  });

  it("strictly refuses to answer when retrieval similarity is below threshold", async () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "chunk-low-1",
        document_id: "doc-1",
        topic_id: "topic-1",
        section_path: "General",
        page: 1,
        content: "Irrelevant background notes.",
        similarity: 0.22,
        citation: "General, p. 1",
      },
    ];

    const result = await explainTopic(
      "Explain quantum chromodynamics",
      chunks,
      0.22, // highest similarity
      0.45 // threshold
    );

    expect(result.refused).toBe(true);
    expect(result.answer).toContain("I couldn't find this in your uploaded material");
    expect(result.citations.length).toBe(0);
  });
});
