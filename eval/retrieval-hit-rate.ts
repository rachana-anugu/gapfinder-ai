import { cosineSimilarity } from "../lib/rag/similarity";
import { getMockEmbedding } from "../lib/rag/embed";
import { reciprocalRankFusion } from "../lib/rag/retrieve";

export interface BenchmarkQuery {
  id: string;
  query: string;
  expectedChunkId: string;
  topic: string;
}

export const BENCHMARK_CHUNKS = [
  { id: "c-dl-1", path: "Ch3 > Deadlocks > Necessary Conditions", text: "Four conditions must hold simultaneously for a deadlock to arise: mutual exclusion, hold and wait, no preemption, and circular wait." },
  { id: "c-dl-2", path: "Ch3 > Deadlocks > Banker's Algorithm", text: "The Banker's Algorithm is a deadlock avoidance algorithm that simulates resource allocation for maximum possible amounts before checking if the system remains in a safe state." },
  { id: "c-dl-3", path: "Ch3 > Deadlocks > Detection Algorithm", text: "A deadlock detection algorithm uses a work vector and finish vector to investigate whether an allocation state contains circular dependencies." },
  { id: "c-dl-4", path: "Ch3 > Deadlocks > Recovery Options", text: "When deadlocks are detected, recovery can occur through process termination (aborting all or one by one) or through resource preemption with rollback." },
  { id: "c-mem-1", path: "Ch4 > Memory Management > Paging", text: "Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory by dividing memory into fixed-size frames and pages." },
  { id: "c-mem-2", path: "Ch4 > Memory Management > Page Tables", text: "The page table translates virtual page numbers to physical frame addresses. Inverted page tables have one entry per frame of real memory." },
  { id: "c-mem-3", path: "Ch4 > Memory Management > Segmentation", text: "Segmentation supports the user view of memory where a logical address space is a collection of variable-length segments, each having a name and length." },
  { id: "c-mem-4", path: "Ch4 > Memory Management > Virtual Memory", text: "Virtual memory involves the separation of user logical memory from physical memory, allowing execution of processes not completely in memory via demand paging." },
  { id: "c-proc-1", path: "Ch1 > Processes > Process Control Block", text: "Each process is represented in the operating system by a process control block (PCB), containing state, program counter, CPU registers, and scheduling info." },
  { id: "c-proc-2", path: "Ch1 > Processes > Context Switch", text: "A context switch occurs when the CPU switches from one process to another, saving the state of the old process and loading the saved state for the new process." },
  { id: "c-sync-1", path: "Ch2 > Synchronization > Critical Section", text: "The critical section problem requires that when one process is executing in its critical section, no other process is allowed to execute in its critical section." },
  { id: "c-sync-2", path: "Ch2 > Synchronization > Semaphores", text: "A semaphore is a synchronization tool that provides two atomic operations: wait() and signal(), maintaining an integer value for resource management." },
  { id: "c-sync-3", path: "Ch2 > Synchronization > Monitors", text: "A monitor is a high-level synchronization construct that encapsulates data variables and procedures, ensuring that only one process can be active within the monitor at a time." },
  { id: "c-cpu-1", path: "Ch2 > Scheduling > Round Robin", text: "Round Robin scheduling allocates a fixed time quantum to each ready process in circular order, preempting processes that do not finish within their quantum." },
  { id: "c-cpu-2", path: "Ch2 > Scheduling > Multi-Level Feedback Queues", text: "Multilevel feedback queue scheduling allows processes to move between queues with different priority levels based on their CPU burst behavior." },
  { id: "c-fs-1", path: "Ch5 > File Systems > File Allocation Methods", text: "Three major methods of allocating disk space are contiguous allocation, linked allocation, and indexed allocation using index blocks." },
  { id: "c-fs-2", path: "Ch5 > File Systems > Directory Structures", text: "Directory structures include single-level, two-level, tree-structured, and acyclic-graph directories allowing file sharing through links." },
  { id: "c-io-1", path: "Ch6 > I/O Systems > DMA", text: "Direct Memory Access (DMA) allows a device controller to transfer an entire block of data directly to or from its own buffer storage to memory without CPU intervention." },
  { id: "c-io-2", path: "Ch6 > I/O Systems > Interrupt Handlers", text: "Interrupt handlers are specialized routines invoked by the hardware interrupt vector table to service asynchronous device I/O events." },
  { id: "c-sec-1", path: "Ch7 > Security > Access Matrix", text: "An access matrix model implements protection where rows represent domains and columns represent objects, defining explicit access rights." },
  { id: "c-sec-2", path: "Ch7 > Security > Authentication Mechanisms", text: "Authentication mechanisms verify the identity of a user through passwords, biometric tokens, or cryptographic challenge-response protocols." },
  { id: "c-vm-1", path: "Ch4 > Memory Management > Thrashing", text: "Thrashing occurs when a process spends more time paging than executing because its active working set exceeds available physical memory frames." },
];

export const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  { id: "q1", query: "What are the four necessary conditions for deadlock to occur?", expectedChunkId: "c-dl-1", topic: "Deadlocks" },
  { id: "q2", query: "How does Banker's algorithm determine safe state?", expectedChunkId: "c-dl-2", topic: "Deadlocks" },
  { id: "q3", query: "How is circular wait detected in an allocation state?", expectedChunkId: "c-dl-3", topic: "Deadlocks" },
  { id: "q4", query: "What recovery alternatives exist when a deadlock is found?", expectedChunkId: "c-dl-4", topic: "Deadlocks" },
  { id: "q5", query: "How does paging eliminate the need for contiguous allocation?", expectedChunkId: "c-mem-1", topic: "Paging" },
  { id: "q6", query: "What is an inverted page table and how does it map addresses?", expectedChunkId: "c-mem-2", topic: "Paging" },
  { id: "q7", query: "What is memory segmentation and how does it differ from paging?", expectedChunkId: "c-mem-3", topic: "Segmentation" },
  { id: "q8", query: "How does virtual memory allow execution of partial processes?", expectedChunkId: "c-mem-4", topic: "Virtual Memory" },
  { id: "q9", query: "What information is stored in a Process Control Block (PCB)?", expectedChunkId: "c-proc-1", topic: "Processes" },
  { id: "q10", query: "What operations occur during an operating system context switch?", expectedChunkId: "c-proc-2", topic: "Processes" },
  { id: "q11", query: "What are the requirements for solving the critical section problem?", expectedChunkId: "c-sync-1", topic: "Synchronization" },
  { id: "q12", query: "How do atomic wait and signal operations work in semaphores?", expectedChunkId: "c-sync-2", topic: "Synchronization" },
  { id: "q13", query: "What is a monitor and how does it guarantee mutual exclusion?", expectedChunkId: "c-sync-3", topic: "Synchronization" },
  { id: "q14", query: "How does the Round Robin time quantum affect CPU scheduling?", expectedChunkId: "c-cpu-1", topic: "Scheduling" },
  { id: "q15", query: "How do processes move between multilevel feedback queues?", expectedChunkId: "c-cpu-2", topic: "Scheduling" },
  { id: "q16", query: "What are the differences between contiguous and indexed file allocation?", expectedChunkId: "c-fs-1", topic: "File Systems" },
  { id: "q17", query: "How do tree-structured and acyclic-graph directories organize files?", expectedChunkId: "c-fs-2", topic: "File Systems" },
  { id: "q18", query: "How does Direct Memory Access (DMA) reduce CPU overhead?", expectedChunkId: "c-io-1", topic: "I/O Systems" },
  { id: "q19", query: "What is an interrupt vector table and interrupt handler routine?", expectedChunkId: "c-io-2", topic: "I/O Systems" },
  { id: "q20", query: "How does the access matrix model enforce domain security?", expectedChunkId: "c-sec-1", topic: "Security" },
  { id: "q21", query: "What protocols are used for cryptographic challenge-response authentication?", expectedChunkId: "c-sec-2", topic: "Security" },
  { id: "q22", query: "Why does thrashing cause high page fault frequency and system slowdown?", expectedChunkId: "c-vm-1", topic: "Virtual Memory" },
];

export function runRetrievalEvaluation() {
  // Pre-embed chunks
  const chunkEmbeddings = BENCHMARK_CHUNKS.map((c) => ({
    id: c.id,
    embedding: getMockEmbedding(c.path + " " + c.text),
  }));

  let hit1Count = 0;
  let hit3Count = 0;
  let hit5Count = 0;
  let reciprocalRankSum = 0;

  for (const q of BENCHMARK_QUERIES) {
    const qEmbedding = getMockEmbedding(q.query);

    // Vector Ranking
    const vectorRankings = BENCHMARK_CHUNKS.map((c, i) => ({
      id: c.id,
      similarity: cosineSimilarity(qEmbedding, chunkEmbeddings[i].embedding),
    })).sort((a, b) => b.similarity - a.similarity);

    // Keyword Ranking
    const qTokens = q.query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const keywordRankings = BENCHMARK_CHUNKS.map((c) => {
      const text = (c.path + " " + c.text).toLowerCase();
      let matchCount = 0;
      for (const t of qTokens) {
        if (text.includes(t)) matchCount++;
      }
      return { id: c.id, matchCount };
    }).sort((a, b) => b.matchCount - a.matchCount);

    // Fusion with RRF
    const fused = reciprocalRankFusion<{ id: string }>([vectorRankings, keywordRankings]);
    const rankedIds = fused.map((f) => f.item.id);

    const rank = rankedIds.indexOf(q.expectedChunkId) + 1;

    if (rank === 1) hit1Count++;
    if (rank > 0 && rank <= 3) hit3Count++;
    if (rank > 0 && rank <= 5) hit5Count++;
    if (rank > 0) reciprocalRankSum += 1 / rank;
  }

  const total = BENCHMARK_QUERIES.length;
  const hit1 = (hit1Count / total) * 100;
  const hit3 = (hit3Count / total) * 100;
  const hit5 = (hit5Count / total) * 100;
  const mrr = reciprocalRankSum / total;

  return {
    totalQueries: total,
    hitAt1: Number(hit1.toFixed(1)),
    hitAt3: Number(hit3.toFixed(1)),
    hitAt5: Number(hit5.toFixed(1)),
    mrr: Number(mrr.toFixed(3)),
  };
}

if (process.argv[1]?.includes("retrieval-hit-rate")) {
  console.log("=== GapFinder RAG Retrieval Evaluation (22 Benchmark Queries) ===");
  const results = runRetrievalEvaluation();
  console.table(results);
}
