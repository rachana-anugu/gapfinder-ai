import { describe, it, expect } from "vitest";
import { chunkPages } from "@/lib/rag/chunk";
import { ParsedPage } from "@/lib/rag/parse";

describe("RAG Chunker (lib/rag/chunk.ts)", () => {
  it("splits by heading hierarchies and preserves breadcrumb paths", () => {
    const pages: ParsedPage[] = [
      {
        page: 1,
        text: `# Operating Systems
## Chapter 3: Deadlocks
### Deadlock Detection Algorithm
Deadlock detection algorithms determine whether a state is deadlocked by constructing a resource-allocation graph or using a matrix-based safety algorithm.

### Deadlock Recovery
When a detection algorithm determines that a deadlock exists, several alternatives are available. One possibility is to abort one or more processes to break the circular wait.`,
      },
    ];

    const chunks = chunkPages(pages, "OS Notes");
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    expect(chunks[0].section_path).toContain("Chapter 3: Deadlocks");
    expect(chunks[0].section_path).toContain("Deadlock Detection Algorithm");
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].content).toContain("resource-allocation graph");

    expect(chunks[1].section_path).toContain("Deadlock Recovery");
    expect(chunks[1].content).toContain("abort one or more processes");
  });

  it("handles multi-page documents and assigns correct page numbers", () => {
    const pages: ParsedPage[] = [
      {
        page: 1,
        text: `# Unit 1: Processes
Processes represent programs in execution. They have program counters, registers, and memory states.`,
      },
      {
        page: 2,
        text: `## Process Scheduling
The process scheduler selects an available process for program execution on the CPU.`,
      },
    ];

    const chunks = chunkPages(pages, "Unit 1");
    expect(chunks.length).toBe(2);
    expect(chunks[0].page).toBe(1);
    expect(chunks[1].page).toBe(2);
    expect(chunks[1].section_path).toContain("Process Scheduling");
  });
});
