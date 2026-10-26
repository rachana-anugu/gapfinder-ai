-- ========================================================
-- GapFinder AI Database Schema (Postgres + pgvector)
-- ========================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('syllabus', 'notes', 'textbook', 'past_paper')),
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Topics Table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  weight NUMERIC NOT NULL DEFAULT 1.0,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Chunks Table
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  section_path TEXT NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  embedding vector(768),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'short_answer')),
  stem TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3)),
  source_chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Attempts Table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Answers Table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  given TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Topic Mastery Table
CREATE TABLE IF NOT EXISTS topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  n_questions INTEGER NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('unassessed', 'weak', 'medium', 'strong')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Plans Table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempt_id UUID REFERENCES attempts(id) ON DELETE SET NULL,
  exam_date DATE NOT NULL,
  minutes_per_day INTEGER NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- Indexes
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_chunks_fts ON chunks USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_topic_id ON chunks(topic_id);

CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON topics(parent_id);

CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);

CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_attempt ON topic_mastery(attempt_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic ON topic_mastery(topic_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);

-- Vector HNSW Indexes (cosine distance)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_topics_embedding ON topics USING hnsw (embedding vector_cosine_ops);

-- ========================================================
-- Row Level Security (RLS)
-- ========================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documents isolation policy" ON documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Topics isolation policy" ON topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Chunks isolation policy" ON chunks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Questions isolation policy" ON questions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Attempts isolation policy" ON attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Answers isolation policy" ON answers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Topic mastery isolation policy" ON topic_mastery
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Plans isolation policy" ON plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========================================================
-- Stored Procedures / Match Functions
-- ========================================================

-- 1. Match Chunks (Vector Search)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(768),
  filter_user_id uuid,
  filter_topic_id uuid DEFAULT NULL,
  k int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  topic_id uuid,
  section_path text,
  page int,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.topic_id,
    c.section_path,
    c.page,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM chunks c
  WHERE c.user_id = filter_user_id
    AND (filter_topic_id IS NULL OR c.topic_id = filter_topic_id)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT k;
END;
$$;

-- 2. Keyword Search for Chunks (Full Text Search)
CREATE OR REPLACE FUNCTION match_chunks_fts(
  search_query text,
  filter_user_id uuid,
  filter_topic_id uuid DEFAULT NULL,
  k int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  topic_id uuid,
  section_path text,
  page int,
  content text,
  rank float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.topic_id,
    c.section_path,
    c.page,
    c.content,
    ts_rank_cd(c.fts, websearch_to_tsquery('english', search_query))::float AS rank
  FROM chunks c
  WHERE c.user_id = filter_user_id
    AND (filter_topic_id IS NULL OR c.topic_id = filter_topic_id)
    AND c.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT k;
END;
$$;
