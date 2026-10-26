# Limitations & Future Roadmap

While GapFinder AI provides grounded, hallucination-resistant academic diagnostics, several engineering and algorithmic limitations exist in the current architecture.

---

## Current Technical Limitations

### 1. Scanned PDFs Require Upstream OCR
- **Current Behavior**: `unpdf` extracts textual font layers embedded within PDF streams.
- **Limitation**: Scanned lecture slides, hand-annotated paper notes, or photocopied past exam papers that contain only bitmap images will yield empty extracted pages.
- **Mitigation / Workaround**: Users must upload searchable PDFs (processed via OCR software like Tesseract or Adobe Acrobat) or Markdown / plain text transcripts.

### 2. Topic Assignment Errors on Closely Overlapping Concepts
- **Current Behavior**: Chunks are mapped to topics using cosine similarity between the chunk embedding and the topic embedding (`name + description`) with a similarity threshold of $0.38$.
- **Limitation**: Highly correlated topics (such as *"Process Synchronization"* and *"Deadlocks"*, or *"Paging"* and *"Virtual Memory"*) share overlapping technical vocabularies. Occasionally, a chunk discussing race conditions might be assigned to Deadlocks rather than Synchronization.
- **Mitigation**: Users can manually reassign or merge topics via the Topic Management interface (`/topics`).

### 3. Short-Answer Grading Less Reliable Than MCQs
- **Current Behavior**: MCQs are graded with 100% deterministic accuracy via exact string comparison in TypeScript. Short-answer questions are evaluated using an LLM rubric (0.0 to 1.0) against the source chunk.
- **Limitation**: While grounded, LLM rubric grading can be sensitive to variations in phrasing, alternate technical synonyms, or varying depth in student answers.
- **Mitigation**: MCQs form the primary diagnostic core of the platform, while short answers are accompanied by cited chunk quotes so students can verify the grade themselves.

### 4. Noisy Mastery Estimates with Few Questions ($n < 2$)
- **Current Behavior**: If a student attempts only 1 question on a topic, a single careless mistake would indicate 0% mastery (weak), or a lucky guess would indicate 100% mastery (strong).
- **Mitigation**: The system enforces an `"unassessed"` band whenever $n < 2$. The scheduler schedules diagnostic tasks for unassessed topics to collect sufficient evidence before assigning high-stakes bands.

### 5. English Language Support Only
- **Current Behavior**: Heading detection heuristics and the Postgres full-text search dictionary (`'english'`) are tuned for English academic terminology. Non-English textbooks will not experience optimal keyword search ranking or heading parsing.

---

## Future Roadmap

1. **Teacher & Class Analytics Dashboard**:
   - Aggregate gap heatmaps across an entire lecture hall or cohort.
   - Surface common cohort misconceptions before midterm exams to guide lecture review sessions.
2. **Parent & Advisor Progress Tracking**:
   - Read-only progress summaries reporting verified study minutes, weekly mastery improvements, and upcoming exam schedules.
3. **Automated Spaced Repetition (SM-2 / FSRS)**:
   - Extend the revision scheduler to dynamically adjust revisit dates based on SuperMemo (SM-2) or Free Spaced Repetition Scheduler (FSRS) intervals following each quiz attempt.
4. **LMS Integration (Canvas, Blackboard, Moodle)**:
   - Direct OAuth synchronization to import syllabus modules, slide decks, and exam schedules automatically without manual file uploads.
5. **Multi-Language RAG Support**:
   - Integrate multilingual embedding models (e.g. `text-embedding-3-small` multilingual or Gemini multilingual) and language-specific text search configurations.
6. **On-Device OCR Preprocessing**:
   - Add client-side or serverless OCR workers (e.g. via Tesseract.js) to automatically transcribe scanned notes and lecture board photos upon upload.
