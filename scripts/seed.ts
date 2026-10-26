import { createAdminClient } from "../lib/supabase/admin";
import { parseDocument } from "../lib/rag/parse";
import { chunkPages } from "../lib/rag/chunk";
import { embedTexts, getMockEmbedding } from "../lib/rag/embed";
import { assignChunksToTopics } from "../lib/rag/assign";
import { scheduleRevisionPlan } from "../lib/diagnosis/plan";
import { phrasePlanTasks } from "../lib/ai/planTasks";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_EMAIL = "demo@gapfinder.app";
export const DEMO_PASSWORD = "Demo@12345";

// 1. Original Syllabus Material
export const SYLLABUS_CONTENT = `# Course Syllabus: Operating Systems (CS-302)
Total Marks: 100 • Credits: 4.0

## Unit 1: Introduction to Operating Systems and Processes (15 Marks)
- Operating system structure, system calls, dual-mode operation (kernel vs user mode).
- Process state model, Process Control Block (PCB), context switching overhead.
- Inter-process communication: shared memory, message passing pipelines.

## Unit 2: CPU Scheduling and Synchronization (20 Marks)
- Scheduling criteria: turnaround time, waiting time, throughput, response time.
- Algorithms: First-Come-First-Served (FCFS), Shortest Job First (SJF), Round Robin (RR), Priority, Multilevel Feedback Queues.
- Concurrency, race conditions, critical section requirements (mutual exclusion, progress, bounded waiting).
- Hardware synchronization: Test-and-Set, Compare-and-Swap.
- Software solutions: Peterson's Algorithm, Semaphores (counting and binary), Monitors, Classic problems (Producer-Consumer, Dining Philosophers).

## Unit 3: Deadlocks (20 Marks)
- System resource allocation graphs, deadlock characterization.
- Four Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
- Deadlock Handling:
  1. Prevention: Invalidating at least one necessary condition.
  2. Avoidance: Safe states, Banker's Algorithm (safety and resource-request algorithms).
  3. Detection: Wait-for graphs for single instances, detection algorithm for multiple instances.
  4. Recovery: Process termination (abort all vs abort one-by-one) and resource preemption (victim selection, rollback, starvation).

## Unit 4: Memory Management and Virtual Memory (25 Marks)
- Logical vs Physical address spaces, Memory Management Unit (MMU).
- Contiguous memory allocation: Fixed vs dynamic partitioning, Best-fit, First-fit, Worst-fit.
- Fragmentation: Internal vs External fragmentation, compaction solutions.
- Non-contiguous allocation: Paging concepts, frames, page tables, Translation Lookaside Buffers (TLB).
- Hierarchical, Hashed, and Inverted Page Table structures.
- Segmentation architecture: Segment tables, base/limit registers, logical to physical translation.
- Virtual Memory: Demand paging, page fault handling routine, valid-invalid bit.
- Page Replacement Algorithms: FIFO, Optimal (Belady's anomaly), Least Recently Used (LRU), Counting-based.
- Thrashing: Working Set Model, Page Fault Frequency (PFF) control.

## Unit 5: Storage and File Systems (20 Marks)
- File attributes, directory structures (single-level, two-level, tree, acyclic graph).
- File allocation techniques: Contiguous allocation, Linked allocation, Indexed allocation.
- Free-space management: Bit vectors, linked free space lists, grouping, counting.
- Disk scheduling: FCFS, SSTF, SCAN, C-SCAN, LOOK.
`;

// 2. Chapter 3 Notes: Deadlocks (~1500 words)
export const DEADLOCKS_NOTES = `# Chapter 3: Deadlocks in Operating Systems
By Department of Computer Science & Engineering • Academic Year 2025-2026

## 3.1 The Deadlock Problem and System Model
In a multiprogramming environment, multiple processes compete for a finite set of resources. A resource may be physical (such as a CPU cycle, disk drive, GPU, or printer) or logical (such as a database record, semaphore, mutex lock, or open file). A process requests resources, uses them if allocated, and releases them upon completion.

A deadlock situation occurs when a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process in the very same set. More formally, a set of processes {P0, P1, ..., Pn} is deadlocked when every process Pi in the set is waiting for an event (typically the release of an allocated resource) that can only be caused by another process Pj in the set.

## 3.2 Necessary Conditions for Deadlock
A deadlock can arise if and only if the following four conditions hold simultaneously in a system:
1. Mutual Exclusion: At least one resource must be held in a non-shareable mode. That is, only one process at a time can use the resource. If another process requests that resource, the requesting process must be delayed until the resource has been released.
2. Hold and Wait: A process must be currently holding at least one resource and simultaneously waiting to acquire additional resources that are currently being held by other processes.
3. No Preemption: Resources cannot be preempted; that is, a resource can only be released voluntarily by the process holding it, after that process has completed its task.
4. Circular Wait: A closed chain of processes must exist, such that each process holds one or more resources that are needed by the next process in the chain. Formally, there exists a set {P0, P1, ..., Pn} of waiting processes such that P0 is waiting for a resource held by P1, P1 is waiting for a resource held by P2, and Pn is waiting for a resource held by P0.

## 3.3 Resource-Allocation Graphs
Deadlocks can be described more precisely in terms of a directed graph called a Resource-Allocation Graph (RAG). The graph consists of a set of vertices V and a set of edges E. Vertices are partitioned into two sets:
- P = {P1, P2, ..., Pn}, representing all active processes in the system.
- R = {R1, R2, ..., Rm}, representing all resource types in the system.
A directed edge from process Pi to resource type Rj (Pi -> Rj) is a request edge, signifying that process Pi has requested an instance of Rj and is currently waiting. A directed edge from resource type Rj to process Pi (Rj -> Pi) is an assignment edge, signifying that an instance of resource Rj has been allocated to process Pi.

Graph Analysis Rule:
- If the resource-allocation graph contains no directed cycles, then no process in the system is deadlocked.
- If the graph contains a cycle and every resource type in the cycle has exactly one instance, then a deadlock definitely exists.
- If each resource type has several instances, a cycle indicates a necessary condition, but does not necessarily guarantee a deadlock.

## 3.4 Deadlock Prevention
Deadlock prevention provides a set of methods to ensure that at least one of the four necessary conditions cannot hold.
1. Eliminating Mutual Exclusion: For shareable resources (such as read-only files), processes do not need mutual exclusion. However, inherently non-shareable resources (such as write locks or printers) cannot bypass this condition.
2. Eliminating Hold and Wait: To prevent hold and wait, the protocol can mandate that each process must request and be allocated all of its required resources before it begins execution, or only allow a process to request resources when it holds none. The downside is low resource utilization and starvation of processes requiring many popular resources.
3. Eliminating No Preemption: If a process that is holding some resources requests another resource that cannot be immediately allocated, all resources currently being held by that process are preempted and placed on the wait list.
4. Eliminating Circular Wait: Impose a global total ordering of all resource types F: R -> N. Each process can only request resources in an increasing order of enumeration. That is, if a process holds resource Ri, it can only request Rj if F(Rj) > F(Ri). This mathematically prevents circular wait cycles.

## 3.5 Deadlock Avoidance and the Banker's Algorithm
Deadlock avoidance requires dynamic information regarding how resources are to be requested. If the maximum number of resources of each type that a process may need is known in advance, the operating system can dynamically examine the resource-allocation state to ensure that a circular wait condition can never develop.

A state is safe if the system can allocate resources to each process (up to its declared maximum) in some order and still avoid a deadlock. More formally, a system is in a safe state only if there exists a safe sequence <P1, P2, ..., Pn> of processes such that, for each Pi, the resources that Pi can still request can be satisfied by currently available resources plus the resources held by all preceding processes Pj (where j < i).

The Banker's Algorithm (developed by Edsger Dijkstra) handles multiple instances of each resource type. It maintains four core data structures:
- Available[m]: An integer array of length m indicating the number of available instances of each resource type.
- Max[n][m]: An n x m matrix defining the maximum demand of each process.
- Allocation[n][m]: An n x m matrix defining the number of resources of each type currently allocated to each process.
- Need[n][m]: An n x m matrix defining the remaining resource need of each process, where Need[i][j] = Max[i][j] - Allocation[i][j].

Safety Algorithm Steps:
1. Let Work and Finish be vectors of length m and n, respectively. Initialize Work = Available and Finish[i] = false for all i.
2. Find an index i such that Finish[i] == false and Need[i] <= Work. If no such i exists, go to step 4.
3. Work = Work + Allocation[i]; Finish[i] = true; go to step 2.
4. If Finish[i] == true for all i, then the system is in a safe state.

## 3.6 Deadlock Detection Algorithm
If a system does not employ deadlock prevention or avoidance, it must provide a detection algorithm accompanied by a recovery scheme.
For systems with multiple instances of resource types, the detection algorithm is an adaptation of the Banker's safety algorithm:
1. Initialize Work = Available. For i = 0 to n-1, if Allocation[i] != 0, Finish[i] = false; else Finish[i] = true.
2. Find an index i such that Finish[i] == false and Request[i] <= Work. If no such i exists, go to step 4.
3. Work = Work + Allocation[i]; Finish[i] = true; go to step 2.
4. If Finish[i] == false for any i, then process Pi is deadlocked.

## 3.7 Recovery from Deadlock
Once a deadlock is detected, the operating system can recover through:
1. Process Termination:
   - Abort all deadlocked processes: Highly effective, but expensive since all partial computations are discarded.
   - Abort one process at a time until the deadlock cycle is eliminated: Adds overhead because the detection algorithm must re-run after each termination.
2. Resource Preemption:
   - Selecting a victim: Determine which resources and which processes are to be preempted based on cost factors (execution time spent, remaining compute time, number of resources held).
   - Rollback: Roll the victim process back to a safe checkpoint state, restarting it from that checkpoint.
   - Preventing Starvation: Ensure that a specific process is not always chosen as the victim by including the number of prior rollbacks in the cost metric.
`;

// 3. Chapter 4 Notes: Memory Management & Paging (~1500 words)
export const MEMORY_NOTES = `# Chapter 4: Memory Management and Virtual Memory
By Department of Computer Science & Engineering • Academic Year 2025-2026

## 4.1 Background and Address Binding
Memory consists of a large array of bytes, each with its own physical address. The CPU fetches instructions from the program counter, decodes them, and fetches required operands from memory addresses. Address binding can take place at compile time (generating absolute code), load time (generating relocatable code), or execution time (using hardware base and limit registers).

The address generated by the CPU is called a logical address (or virtual address), whereas an address loaded into the memory address register of the memory bus is called a physical address. The run-time mapping from logical to physical addresses is handled by a specialized hardware device called the Memory Management Unit (MMU). In simple relocation schemes, the value of the relocation register (base register) is added to every logical address generated by a user process at the hardware boundary.

## 4.2 Contiguous Memory Allocation and Fragmentation
In contiguous memory allocation, each process is contained in a single contiguous section of physical memory. In variable-partition allocation schemes, the operating system keeps a table indicating which parts of memory are available (holes) and which are occupied:
- First-fit: Allocate the first hole that is big enough. Fast search overhead.
- Best-fit: Allocate the smallest hole that is big enough. Produces the smallest leftover hole.
- Worst-fit: Allocate the largest available hole. Produces the largest leftover hole, which may be more useful than tiny leftovers.

Fragmentation Challenges:
- External Fragmentation: Total free memory space exists to satisfy a request, but it is not contiguous; it is fragmented into a large number of small, separated holes. Compaction can reduce external fragmentation by shuffling memory contents to place all free memory together in one large block, but compaction is only feasible if relocation is dynamic at execution time.
- Internal Fragmentation: Memory allocated to a process may be slightly larger than the requested size due to fixed partition quantum sizing. The difference between allocated and utilized memory inside the partition is internal fragmentation.

## 4.3 Paging Architecture
Paging is a non-contiguous memory-management scheme that completely eliminates external fragmentation and the requirement for contiguous allocation.
Physical memory is broken into fixed-sized blocks called frames. Logical memory is broken into blocks of the exact same size called pages. Typical page sizes are powers of 2, usually ranging between 4 KB and 64 KB.

Every logical address generated by the CPU is divided into two distinct components:
- Page Number (p): Used as an index into a per-process page table.
- Page Offset (d): Combined with the base frame address to define the exact physical memory location.
If the size of the logical address space is 2^m, and a page size is 2^n bytes, then the high-order (m - n) bits of a logical address designate the page number, and the n low-order bits designate the page offset.

The Page Table contains the base physical address of each frame in physical memory. The MMU looks up page p in the page table to find the corresponding physical frame f. The physical address is then computed as (f * frame_size) + d.

Hardware Translation Acceleration:
Accessing memory through a page table stored in main memory doubles the memory access latency (one memory access to fetch the page table entry, and a second access to fetch the actual operand). To alleviate this latency, modern MMUs utilize a special, small, high-speed lookup hardware cache called the Translation Lookaside Buffer (TLB).
- When a logical address is translated, its page number is presented to the TLB.
- If the page number is found (TLB hit), its frame number is immediately available with zero memory access delay.
- If the page number is not present (TLB miss), a memory reference to the page table is performed. The resulting frame is added to the TLB for subsequent accesses.
- Effective Memory Access Time (EMAT) is defined as: EMAT = (TLB_hit_rate * (TLB_access_time + Memory_access_time)) + ((1 - TLB_hit_rate) * (TLB_access_time + 2 * Memory_access_time)).

## 4.4 Advanced Page Table Structures
As logical address spaces have expanded to 64-bit architectures, standard linear page tables have become prohibitively large (a 32-bit system with 4 KB pages requires 2^20 entries, equal to 4 MB per process).
1. Hierarchical Paging (Multi-level Paging): Paging the page table itself. In a two-level paging scheme on a 32-bit machine, the 20-bit page number is split into a 10-bit outer page table index and a 10-bit page table page offset.
2. Hashed Page Tables: The virtual page number is hashed into a hash table. Each entry in the hash table contains a linked list of elements that hash to the same location, with each element storing the virtual page number, mapped frame number, and a pointer to the next element.
3. Inverted Page Tables: Rather than maintaining a page table entry for every logical page of every process, an inverted page table has exactly one entry for each real page (or frame) of physical memory. Each entry consists of the virtual address of the page stored in that real memory location, along with information about the process that owns that page (<process-id, page-number>). This dramatically reduces physical memory overhead, but increases the search time needed to translate a logical address to a physical address.

## 4.5 Virtual Memory and Demand Paging
Virtual memory is a technique that allows the execution of processes that are not completely in physical memory. The major advantage is that user programs can be larger than available physical memory, freeing programmers from hardware memory constraints.

Demand Paging loads pages into physical memory only when they are referenced during execution:
1. When a process attempts to access a page, the hardware checks the valid-invalid bit in the page table entry.
2. If the bit is marked valid, the page is resident in physical memory, and the access proceeds normally.
3. If the bit is marked invalid, a page fault trap occurs to the operating system kernel.
4. The OS kernel inspects an internal table to determine whether the access was an invalid memory reference or just a page not yet brought into memory.
5. If the reference is legitimate, the OS locates an available free frame from the free-frame pool.
6. The OS schedules a disk I/O operation to read the desired page from backing store into the allocated physical frame.
7. Once the disk transfer completes, the page table entry is updated to point to the new frame, and its bit is changed to valid.
8. The instruction that caused the page fault is restarted seamlessly.

## 4.6 Page Replacement Algorithms
When a page fault occurs and no free frames are available in physical memory, the operating system must find a victim frame, write it to disk if it was modified (dirty bit is set), and swap in the requested page.
- FIFO (First-In, First-Out): The simplest algorithm. Replaces the oldest page in memory. Suffers from Belady's Anomaly, where increasing the number of allocated physical frames can paradoxically increase the number of page faults.
- Optimal Algorithm (OPT): Replaces the page that will not be used for the longest period of time in the future. Serves as the theoretical benchmark against which other algorithms are compared, but is impossible to implement in practice because it requires future knowledge of memory references.
- Least Recently Used (LRU): Replaces the page that has not been referenced for the longest period of time. Approximates OPT by using recent past behavior as a predictor of future behavior. Requires hardware counter or stack support to record access timestamps.

## 4.7 Thrashing and the Working-Set Model
If a process does not have enough physical frames to hold its active working set of pages, it will very quickly page-fault. It must replace some existing page, which is itself immediately referenced again. Consequently, the process spends vastly more time waiting for the paging device than executing CPU instructions. This high paging activity is called thrashing.

The Working-Set Model (developed by Peter Denning) is based on the assumption of reference locality. A working-set window delta defines a fixed number of page references. The working set of process Pi (WSSi) is the set of pages referenced in the most recent delta page references. The total demand for frames in the system is D = sum(WSSi). If total demand D exceeds the available physical memory frames, the OS must suspend one or more processes to avoid thrashing and maintain high CPU throughput.
`;

// 4. Past Exam Paper (Style Calibration)
export const PAST_PAPER_CONTENT = `# University Examination: Operating Systems (Paper Code: CS-302)
Maximum Marks: 100 • Time Allowed: 3 Hours

Instructions: Answer any FIVE full questions, selecting at least ONE question from each module.

### Section A
Q1 (a) Explain the Process Control Block (PCB) and outline the sequence of hardware and software operations performed during a context switch between two processes. [8 Marks]
Q1 (b) State and explain the four Coffman conditions necessary for a system deadlock to arise. [7 Marks]

### Section B
Q2 (a) Consider the following snapshot of a system with 5 processes (P0-P4) and 3 resource types (A=10, B=5, C=7):
      Execute the Banker's safety algorithm to determine if the system is in a safe state. Derive the safe sequence. [10 Marks]
Q2 (b) Describe how circular wait can be prevented by establishing a total ordering of all resource types. [5 Marks]

### Section C
Q3 (a) Differentiate clearly between internal and external fragmentation. Explain how non-contiguous paging eliminates external fragmentation. [8 Marks]
Q3 (b) A 32-bit machine uses a two-level page table with 4 KB page sizes. Explain how logical addresses are translated to physical frames. [7 Marks]

### Section D
Q4 (a) Describe the step-by-step handling of a page fault by the operating system kernel when demand paging is active. [8 Marks]
Q4 (b) What is thrashing? Explain how the Working Set Model prevents system thrashing. [7 Marks]
`;

export async function runSeed() {
  console.log("=========================================================");
  console.log("GAPFINDER AI - DATABASE & DEMO USER SEED SCRIPT");
  console.log("=========================================================\n");

  const supabase = createAdminClient();

  // 1. Create or verify Demo User
  console.log(`1. Ensuring Demo User exists (${DEMO_EMAIL})...`);
  try {
    const { data: userExists } = await supabase.auth.admin.getUserById(DEMO_USER_ID);
    if (!userExists?.user) {
      await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      console.log("   ✓ Created Demo User with UID:", DEMO_USER_ID);
    } else {
      console.log("   ✓ Demo User already exists.");
    }
  } catch (err: any) {
    console.log("   Notice: Admin user check bypassed (using offline/demo context):", err.message);
  }

  // 2. Clear old demo data for clean state
  console.log("2. Cleaning old records for Demo User...");
  await supabase.from("documents").delete().eq("user_id", DEMO_USER_ID);
  await supabase.from("topics").delete().eq("user_id", DEMO_USER_ID);
  await supabase.from("attempts").delete().eq("user_id", DEMO_USER_ID);
  await supabase.from("plans").delete().eq("user_id", DEMO_USER_ID);

  // 3. Insert Documents
  console.log("3. Ingesting Course Materials (Syllabus, 2 Chapter Notes, Past Paper)...");
  const docSyllabusId = crypto.randomUUID();
  const docDeadlocksId = crypto.randomUUID();
  const docMemoryId = crypto.randomUUID();
  const docPastPaperId = crypto.randomUUID();

  await supabase.from("documents").insert([
    { id: docSyllabusId, user_id: DEMO_USER_ID, name: "OS_Syllabus.md", kind: "syllabus", file_size: SYLLABUS_CONTENT.length },
    { id: docDeadlocksId, user_id: DEMO_USER_ID, name: "OS_Ch3_Deadlocks_Notes.md", kind: "notes", file_size: DEADLOCKS_NOTES.length },
    { id: docMemoryId, user_id: DEMO_USER_ID, name: "OS_Ch4_Memory_Management_Notes.md", kind: "notes", file_size: MEMORY_NOTES.length },
    { id: docPastPaperId, user_id: DEMO_USER_ID, name: "OS_Past_Exam_Paper_2025.md", kind: "past_paper", file_size: PAST_PAPER_CONTENT.length },
  ]);

  // 4. Parse & Chunk Documents
  console.log("4. Chunking documents with heading hierarchies & page tracking...");
  const syllabusPages = await parseDocument(Buffer.from(SYLLABUS_CONTENT), "OS_Syllabus.md");
  const deadlocksPages = await parseDocument(Buffer.from(DEADLOCKS_NOTES), "OS_Ch3_Deadlocks_Notes.md");
  const memoryPages = await parseDocument(Buffer.from(MEMORY_NOTES), "OS_Ch4_Memory_Management_Notes.md");
  const pastPaperPages = await parseDocument(Buffer.from(PAST_PAPER_CONTENT), "OS_Past_Exam_Paper_2025.md");

  const syllabusChunks = chunkPages(syllabusPages, "Syllabus");
  const deadlocksChunks = chunkPages(deadlocksPages, "Ch3: Deadlocks");
  const memoryChunks = chunkPages(memoryPages, "Ch4: Memory Management");
  const pastPaperChunks = chunkPages(pastPaperPages, "Past Paper 2025");

  // Embed Chunks
  console.log("5. Generating 768-dim embeddings for knowledge chunks...");
  const allDocChunks = [
    ...syllabusChunks.map((c) => ({ ...c, doc_id: docSyllabusId })),
    ...deadlocksChunks.map((c) => ({ ...c, doc_id: docDeadlocksId })),
    ...memoryChunks.map((c) => ({ ...c, doc_id: docMemoryId })),
    ...pastPaperChunks.map((c) => ({ ...c, doc_id: docPastPaperId })),
  ];

  const embeddings = await embedTexts(allDocChunks.map((c) => c.content));

  const chunkRows = allDocChunks.map((c, i) => ({
    id: crypto.randomUUID(),
    user_id: DEMO_USER_ID,
    document_id: c.doc_id,
    section_path: c.section_path,
    page: c.page,
    content: c.content,
    embedding: embeddings[i] || getMockEmbedding(c.content),
  }));

  await supabase.from("chunks").insert(chunkRows);
  console.log(`   ✓ Ingested ${chunkRows.length} knowledge chunks.`);

  // 6. Create Topics Tree
  console.log("6. Creating Topic Tree with syllabus weights...");
  const tDeadlocksId = crypto.randomUUID();
  const tMemoryId = crypto.randomUUID();
  const tSyncId = crypto.randomUUID();
  const tCpuId = crypto.randomUUID();
  const tFilesId = crypto.randomUUID();

  const topicsToInsert = [
    { id: tDeadlocksId, user_id: DEMO_USER_ID, name: "Deadlocks & Resource Allocation", description: "Coffman conditions, Banker's algorithm, prevention, detection and recovery mechanisms.", weight: 2.5 },
    { id: tMemoryId, user_id: DEMO_USER_ID, name: "Memory Management & Paging", description: "Paging, page tables, TLBs, segmentation, virtual memory demand paging, and thrashing.", weight: 3.0 },
    { id: tSyncId, user_id: DEMO_USER_ID, name: "Process Synchronization", description: "Critical section, semaphores, monitors, mutex locks, and classic concurrency problems.", weight: 2.0 },
    { id: tCpuId, user_id: DEMO_USER_ID, name: "CPU Scheduling & Processes", description: "Process lifecycle, PCB, context switching, Round Robin, SJF, and multilevel queues.", weight: 1.5 },
    { id: tFilesId, user_id: DEMO_USER_ID, name: "Storage & File Systems", description: "Directory trees, contiguous and indexed file allocation, disk scheduling algorithms.", weight: 1.5 },
  ];

  const topicTexts = topicsToInsert.map((t) => `${t.name}: ${t.description}`);
  const topicEmbeddings = await embedTexts(topicTexts);

  for (let i = 0; i < topicsToInsert.length; i++) {
    await supabase.from("topics").insert({
      ...topicsToInsert[i],
      embedding: topicEmbeddings[i] || getMockEmbedding(topicTexts[i]),
    });
  }
  console.log("   ✓ Inserted 5 syllabus topics.");

  // 7. Auto-Assign Chunks to Topics
  console.log("7. Assigning chunks to nearest topic above similarity threshold (0.38)...");
  const topicAssignList = topicsToInsert.map((t, i) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    embedding: topicEmbeddings[i],
  }));

  const chunkAssignList = chunkRows.map((c) => ({
    id: c.id,
    content: c.content,
    section_path: c.section_path,
    embedding: c.embedding,
  }));

  const assignments = await assignChunksToTopics(chunkAssignList, topicAssignList, 0.38);
  for (const a of assignments) {
    if (a.topicId) {
      await supabase.from("chunks").update({ topic_id: a.topicId }).eq("id", a.chunkId);
    }
  }
  console.log("   ✓ Assigned chunks to topics.");

  // 8. Pre-Seed 3 Historical Attempts Showing Mastery Improvement
  console.log("8. Pre-seeding 3 historical attempts showing improvement...");

  // Select sample chunks for question sources
  const deadlockChunk = chunkRows.find((c) => c.section_path.includes("Deadlocks")) || chunkRows[0];
  const memoryChunk = chunkRows.find((c) => c.section_path.includes("Memory")) || chunkRows[1];

  // Questions
  const q1Id = crypto.randomUUID();
  const q2Id = crypto.randomUUID();
  const q3Id = crypto.randomUUID();
  const q4Id = crypto.randomUUID();

  await supabase.from("questions").insert([
    {
      id: q1Id,
      user_id: DEMO_USER_ID,
      topic_id: tDeadlocksId,
      type: "mcq",
      stem: "Which of the following is NOT one of the four necessary conditions for deadlock?",
      options: ["Mutual Exclusion", "Hold and Wait", "Preemptive Resource Sharing", "Circular Wait"],
      correct: "Preemptive Resource Sharing",
      difficulty: 1,
      source_chunk_id: deadlockChunk.id,
      verified: true,
    },
    {
      id: q2Id,
      user_id: DEMO_USER_ID,
      topic_id: tDeadlocksId,
      type: "mcq",
      stem: "What safety condition does the Banker's algorithm evaluate before granting resources?",
      options: ["All processes immediately terminate", "A safe sequence exists to satisfy maximum demands", "External fragmentation is minimized", "Total memory exceeds swap size"],
      correct: "A safe sequence exists to satisfy maximum demands",
      difficulty: 2,
      source_chunk_id: deadlockChunk.id,
      verified: true,
    },
    {
      id: q3Id,
      user_id: DEMO_USER_ID,
      topic_id: tMemoryId,
      type: "mcq",
      stem: "How does non-contiguous paging eliminate external fragmentation?",
      options: ["By allocating variable size partitions", "By breaking physical memory into fixed-size frames matching page sizes", "By utilizing virtual segmentation registers", "By requiring continuous memory compaction"],
      correct: "By breaking physical memory into fixed-size frames matching page sizes",
      difficulty: 2,
      source_chunk_id: memoryChunk.id,
      verified: true,
    },
    {
      id: q4Id,
      user_id: DEMO_USER_ID,
      topic_id: tMemoryId,
      type: "short_answer",
      stem: "What causes thrashing in an operating system, and how does the working set model mitigate it?",
      options: [],
      correct: "Thrashing occurs when active working sets exceed physical memory frames, causing excessive page fault latency.",
      difficulty: 3,
      source_chunk_id: memoryChunk.id,
      verified: true,
    },
  ]);

  // Attempt 1: 3 days ago - Score 33% (Poor baseline, student struggled on Deadlocks & Paging)
  const att1Id = crypto.randomUUID();
  const date3DaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  await supabase.from("attempts").insert({
    id: att1Id,
    user_id: DEMO_USER_ID,
    topic_ids: [tDeadlocksId, tMemoryId],
    score: 0.33,
    total_questions: 3,
    status: "completed",
    created_at: date3DaysAgo,
  });

  await supabase.from("answers").insert([
    { user_id: DEMO_USER_ID, attempt_id: att1Id, question_id: q1Id, given: "Mutual Exclusion", is_correct: false, score: 0.0, explanation: "Incorrect. Mutual exclusion is one of the four necessary conditions.", created_at: date3DaysAgo },
    { user_id: DEMO_USER_ID, attempt_id: att1Id, question_id: q2Id, given: "External fragmentation is minimized", is_correct: false, score: 0.0, explanation: "Incorrect. Banker's algorithm checks for safe execution sequences.", created_at: date3DaysAgo },
    { user_id: DEMO_USER_ID, attempt_id: att1Id, question_id: q3Id, given: "By breaking physical memory into fixed-size frames matching page sizes", is_correct: true, score: 1.0, explanation: "Correct! Paging uses equal frame sizes to avoid external fragmentation.", created_at: date3DaysAgo },
  ]);

  await supabase.from("topic_mastery").insert([
    { user_id: DEMO_USER_ID, attempt_id: att1Id, topic_id: tDeadlocksId, score: 0.0, n_questions: 2, band: "weak", reason: "Scored 0% across 2 questions; missed core Coffman conditions.", created_at: date3DaysAgo },
    { user_id: DEMO_USER_ID, attempt_id: att1Id, topic_id: tMemoryId, score: 0.50, n_questions: 2, band: "medium", reason: "Demonstrates basic familiarity with paging frames.", created_at: date3DaysAgo },
  ]);

  // Attempt 2: 1 day ago - Score 60% (Improving)
  const att2Id = crypto.randomUUID();
  const date1DayAgo = new Date(Date.now() - 1 * 86400000).toISOString();

  await supabase.from("attempts").insert({
    id: att2Id,
    user_id: DEMO_USER_ID,
    topic_ids: [tDeadlocksId, tMemoryId],
    score: 0.60,
    total_questions: 3,
    status: "completed",
    created_at: date1DayAgo,
  });

  await supabase.from("answers").insert([
    { user_id: DEMO_USER_ID, attempt_id: att2Id, question_id: q1Id, given: "Preemptive Resource Sharing", is_correct: true, score: 1.0, explanation: "Correct! No Preemption is the condition, not preemptive sharing.", created_at: date1DayAgo },
    { user_id: DEMO_USER_ID, attempt_id: att2Id, question_id: q2Id, given: "External fragmentation is minimized", is_correct: false, score: 0.0, explanation: "Incorrect. Banker's algorithm evaluates safe sequences.", created_at: date1DayAgo },
    { user_id: DEMO_USER_ID, attempt_id: att2Id, question_id: q3Id, given: "By breaking physical memory into fixed-size frames matching page sizes", is_correct: true, score: 1.0, explanation: "Correct! Verified at Ch4 Notes, p. 2.", created_at: date1DayAgo },
  ]);

  await supabase.from("topic_mastery").insert([
    { user_id: DEMO_USER_ID, attempt_id: att2Id, topic_id: tDeadlocksId, score: 0.50, n_questions: 2, band: "medium", reason: "Improved to 50%; understands basic conditions but missed Banker's algorithm.", created_at: date1DayAgo },
    { user_id: DEMO_USER_ID, attempt_id: att2Id, topic_id: tMemoryId, score: 0.70, n_questions: 2, band: "medium", reason: "Consistent comprehension of paging frames and page tables.", created_at: date1DayAgo },
  ]);

  // Attempt 3: Today - Score 85% (Solid progress)
  const att3Id = crypto.randomUUID();
  const dateToday = new Date().toISOString();

  await supabase.from("attempts").insert({
    id: att3Id,
    user_id: DEMO_USER_ID,
    topic_ids: [tDeadlocksId, tMemoryId],
    score: 0.85,
    total_questions: 4,
    status: "completed",
    created_at: dateToday,
  });

  await supabase.from("answers").insert([
    { user_id: DEMO_USER_ID, attempt_id: att3Id, question_id: q1Id, given: "Preemptive Resource Sharing", is_correct: true, score: 1.0, explanation: "Correct! Coffman condition is No Preemption.", created_at: dateToday },
    { user_id: DEMO_USER_ID, attempt_id: att3Id, question_id: q2Id, given: "A safe sequence exists to satisfy maximum demands", is_correct: true, score: 1.0, explanation: "Correct! Banker's algorithm simulates safe sequences.", created_at: dateToday },
    { user_id: DEMO_USER_ID, attempt_id: att3Id, question_id: q3Id, given: "By breaking physical memory into fixed-size frames matching page sizes", is_correct: true, score: 1.0, explanation: "Correct! Verified at Ch4, p. 2.", created_at: dateToday },
    { user_id: DEMO_USER_ID, attempt_id: att3Id, question_id: q4Id, given: "Working set exceeds physical frames causing excessive paging.", is_correct: false, score: 0.5, explanation: "Partially correct; missed explanation of working set model.", created_at: dateToday },
  ]);

  await supabase.from("topic_mastery").insert([
    { user_id: DEMO_USER_ID, attempt_id: att3Id, topic_id: tDeadlocksId, score: 0.90, n_questions: 2, band: "strong", reason: "Demonstrates strong mastery across Coffman conditions and Banker's safety state.", created_at: dateToday },
    { user_id: DEMO_USER_ID, attempt_id: att3Id, topic_id: tMemoryId, score: 0.65, n_questions: 2, band: "medium", reason: "Good understanding of paging, but needs practice on thrashing.", created_at: dateToday },
    { user_id: DEMO_USER_ID, attempt_id: att3Id, topic_id: tSyncId, score: 0.0, n_questions: 0, band: "unassessed", reason: "0 questions attempted; diagnostic required.", created_at: dateToday },
  ]);

  // 9. Pre-seed Initial Adaptive Revision Plan
  console.log("9. Pre-seeding Adaptive Revision Plan...");
  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 10);
  const examDateStr = examDate.toISOString().split("T")[0];

  const planTopics = [
    { id: tSyncId, name: "Process Synchronization", weight: 2.0, score: 0.0, band: "unassessed" as const, n_questions: 0, cited_sections: ["Ch2 > Semaphores"] },
    { id: tMemoryId, name: "Memory Management & Paging", weight: 3.0, score: 0.65, band: "medium" as const, n_questions: 4, cited_sections: ["Ch4 > Thrashing", "Ch4 > Page Tables"] },
    { id: tDeadlocksId, name: "Deadlocks & Resource Allocation", weight: 2.5, score: 0.90, band: "strong" as const, n_questions: 6, cited_sections: ["Ch3 > Banker's Algorithm"] },
    { id: tCpuId, name: "CPU Scheduling & Processes", weight: 1.5, score: 0.0, band: "unassessed" as const, n_questions: 0, cited_sections: [] },
  ];

  const scheduled = scheduleRevisionPlan(planTopics, examDateStr, 60);
  const phrased = await phrasePlanTasks(scheduled);

  await supabase.from("plans").insert({
    id: crypto.randomUUID(),
    user_id: DEMO_USER_ID,
    attempt_id: att3Id,
    exam_date: examDateStr,
    minutes_per_day: 60,
    items: phrased,
  });

  console.log("\n=========================================================");
  console.log("SEED COMPLETED SUCCESSFULLY!");
  console.log("=========================================================");
  console.log("Demo Credentials:");
  console.log(`- Email:    ${DEMO_EMAIL}`);
  console.log(`- Password: ${DEMO_PASSWORD}`);
  console.log("- Data:     Syllabus + 2 full chapters + 3 quiz attempts + revision plan");
  console.log("=========================================================\n");
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
});
