# AI Workflow: Separation of Concerns

GapFinder AI enforces a strict boundary between retrieval, LLM generation, and deterministic TypeScript computation.

---

## Process Matrix

| Step / Workflow | Retrieval | LLM Generation | Deterministic TypeScript Code | Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **1. Syllabus Topic Tree Mapping** | Fetches uploaded syllabus & past paper chunks. | Formulates structured units, subtopics, and weights using `generateObject` with `TopicTreeSchema`. | Parses heading hierarchy fallback; flattens and validates tree structure. | Model is passed only syllabus chunks. If offline, deterministic regex parses units. |
| **2. Chunk-to-Topic Assignment** | Fetches chunk embeddings and topic embeddings. | *None* | Computes cosine similarities; matches chunk to nearest topic if $\ge 0.38$; marks $<0.38$ as uncovered. | Executed in pure TypeScript (`assign.ts`); zero LLM involvement. |
| **3. Question Generation** | Hybrid retrieval (`match_chunks` + `match_chunks_fts` via RRF) extracts top 6 chunks. | Writes MCQ stem, 4 options, or short-answer prompt with target difficulty (1–3). | Validates in code that `source_chunk_id` is in the input retrieved set. Retries up to 2 times if invalid. | Generator accepts only `ChunkForGeneration[]`. Hallucinated chunk IDs are rejected at code level. |
| **4. Question Verification** | Loads cited source chunk. | Adversarially verifies: *"Does this chunk alone support the answer, and are distractors wrong?"* | Validates logical conjunction `chunkSupports && distractorsWrong && passed`. Drops question if false. | Question `verified` field in Postgres is set to `true` only if strict code conjunction passes. |
| **5. MCQ Grading** | Loads question and cited chunk from database. | *None* | Performs exact normalized string comparison between `given` and `correct`. Outputs score $1.0$ or $0.0$. | Core Design Principle: LLM is never invoked to grade MCQs. Handled entirely in `evaluate.ts`. |
| **6. Short-Answer Grading** | Loads cited source chunk. | Evaluates answer against source chunk using a structured rubric (score 0.0 to 1.0). | Thresholds mastery at $\text{score} \ge 0.7$; records score in `answers` table. | Evaluator prompt accepts only the cited chunk text as reference truth. |
| **7. Answer Explanation** | Loads question, student answer, and cited chunk. | Writes 1–2 sentence explanation explaining correctness and quoting the source chunk. | Appends formatted citation (`"Section path, p. N"`) and citation drawer payload. | Explanation schema requires quoting verbatim phrases from the chunk. |
| **8. Topic Mastery Calculation** | Loads answers grouped by topic across historical attempts. | *None* | Computes weighted mastery with difficulty weights (1, 1.5, 2) and recency decay ($0.8^{\text{attemptsAgo}}$). | Pure mathematical formula in `mastery.ts`. Zero LLM involvement. |
| **9. Mastery Banding** | Reads question count $n$ and mastery score. | *None* | Evaluates deterministic band: $n < 2 \to$ `unassessed`; $<0.5 \to$ `weak`; $<0.75 \to$ `medium`; else `strong`. | Hard-coded if/else rules in `computeBand`. LLM cannot modify band. |
| **10. Parent Topic Roll-up** | Reads topic hierarchy (`parent_id`, `weight`). | *None* | Computes weighted averages across subtopics to generate rolled-up parent unit scores. | Pure math in `rollupParentTopics`. |
| **11. Gap Reason Formulation** | Reads deterministic score, $n$, missed sections, and stems. | Writes exactly ONE sentence verbalizing the diagnostic reason. | Code validates single sentence length and guarantees the deterministic band is untouched. | Prompt passes code-computed facts only. Band is locked. |
| **12. Revision Plan Scheduling** | Loads diagnosed topics, exam date, and daily study minutes. | *None* | Greedy calendar scheduler fills daily capacities, prioritizing weak topics and scheduling revisit slots. | Pure greedy allocation algorithm in `plan.ts`. |
| **13. Plan Task Phrasing** | Reads scheduled plan items with topic and cited sections. | Generates clear 1-sentence actionable task descriptions. | Retains locked task dates, minutes, task types, and topic IDs without alteration. | LLM output is mapped back by task ID onto pre-scheduled items. |
| **14. Explain-This-Topic Assistant** | Hybrid retrieves top 6 chunks for the user's question. | Formulates pedagogical explanation strictly from chunk text. | Checks if $\max(\text{similarity}) < 0.45$. If true, bypasses LLM and returns refusal message. | Refusal occurs before LLM generation if confidence is below threshold. |
