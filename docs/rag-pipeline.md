# RAG Pipeline Specification

The GapFinder retrieval-augmented generation (RAG) pipeline is designed specifically to prevent hallucinations and establish reliable academic citations.

---

## 1. Document Parsing (`lib/rag/parse.ts`)
- **PDF Extraction**: Utilizes `unpdf` to extract textual layers per page while strictly tracking page numbers ($p \in [1, N]$).
- **Markdown / Plain Text**: Detects explicit page breaks (`\f`, `<!-- pagebreak -->`, `===Page N===`) or defaults to single-page indexing.
- **Output**: Array of `{ page: number, text: string }`.

---

## 2. Heading-Aware Hierarchy Chunking (`lib/rag/chunk.ts`)
- **Section Stack**: Detects structural headings (`#`, `##`, `Chapter N`, `Section Y`, `Unit Z`) and maintains a hierarchical breadcrumb stack.
  - Example: `["Operating Systems", "Chapter 3: Deadlocks", "3.5 Banker's Algorithm"]` $\to$ `"Operating Systems > Chapter 3: Deadlocks > 3.5 Banker's Algorithm"`.
- **Windowing Parameters**:
  - Target chunk size: **400–600 tokens** (~375 words, ~2,000 characters).
  - Window overlap: **~80 tokens** (~60 words, ~350 characters).
- **Metadata Stored**:
  - `section_path`: Full breadcrumb path.
  - `page`: Exact document page number.
  - `content`: Extracted text content.

---

## 3. Fixed 768-Dimension Embeddings (`lib/rag/embed.ts`)
To allow fair cosine distance comparison across chunks, topics, and queries, a single fixed embedding dimension (**768**) is enforced across the entire system.
- **Google Gemini (Default)**: `google.textEmbeddingModel('text-embedding-004')` natively outputs 768-dimensional normalized vectors.
- **OpenAI (Swappable)**: `openai.textEmbeddingModel('text-embedding-3-small', { dimensions: 768 })`.
- **CI / Mock Fallback**: `getMockEmbedding` generates deterministic, normalized 768-dim hash vectors when API keys are absent, ensuring offline tests and builds never fail.

---

## 4. Topic Assignment & Uncovered Material (`lib/rag/assign.ts`)
1. Each topic's name and description are embedded into 768 dimensions.
2. Cosine similarity is computed between each chunk embedding and every topic embedding.
3. If $\max(\text{similarity}) \ge 0.38$:
   - `chunk.topic_id` is assigned to the nearest topic.
4. If $\max(\text{similarity}) < 0.38$:
   - `chunk.topic_id` remains `NULL`.
   - The chunk is flagged as **"Uncovered Material"** in the UI, surfacing course content that falls outside the official syllabus.

---

## 5. Hybrid Retrieval with Reciprocal Rank Fusion (`lib/rag/retrieve.ts`)
GapFinder merges semantic vector search with exact keyword search using **Reciprocal Rank Fusion (RRF)**:

### Search Methods
1. **Vector Search (Cosine Distance)**:
   - Queries `match_chunks` stored RPC function:
     $$\text{similarity} = 1 - (c.\text{embedding} \Leftrightarrow q.\text{embedding})$$
   - Filters by `user_id` and optional `topic_id`. Top $2k$ candidates fetched.
2. **Full-Text Keyword Search (FTS)**:
   - Queries `match_chunks_fts` stored RPC using Postgres `tsvector` and `websearch_to_tsquery('english', query)` with `ts_rank_cd`.

### Fusion Formula
For each candidate chunk $d$:
$$RRF(d) = \sum_{m \in \{\text{vector}, \text{fts}\}} \frac{1}{60 + \text{rank}_m(d)}$$
Candidates are sorted by descending $RRF(d)$ and top 6–8 chunks are returned.

---

## 6. Strict Refusal Threshold
To prevent model hallucinations when queries are out-of-scope (e.g. asking a biology question against an Operating Systems textbook):
- **Refusal Threshold**: $\tau = 0.45$ (configured via `RETRIEVAL_THRESHOLD` env var).
- If $\max_{c \in \text{Retrieved}}(\text{similarity}_c) < \tau$:
  - The assistant strictly returns:
    > *"I couldn't find this in your uploaded material."*
  - The UI renders an amber alert indicating the confidence score was below threshold.
