export type DocumentKind = "syllabus" | "notes" | "textbook" | "past_paper";

export interface DocumentRow {
  id: string;
  user_id: string;
  name: string;
  kind: DocumentKind;
  file_size: number;
  created_at: string;
}

export interface TopicRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  description: string;
  weight: number;
  embedding: number[] | null;
  created_at: string;
}

export interface ChunkRow {
  id: string;
  user_id: string;
  document_id: string;
  topic_id: string | null;
  section_path: string;
  page: number;
  content: string;
  embedding: number[] | null;
  created_at: string;
}

export type QuestionType = "mcq" | "short_answer";

export interface QuestionRow {
  id: string;
  user_id: string;
  topic_id: string;
  type: QuestionType;
  stem: string;
  options: string[];
  correct: string;
  difficulty: 1 | 2 | 3;
  source_chunk_id: string;
  verified: boolean;
  created_at: string;
}

export interface AttemptRow {
  id: string;
  user_id: string;
  topic_ids: string[];
  score: number;
  total_questions: number;
  status: "completed" | "in_progress";
  created_at: string;
}

export interface AnswerRow {
  id: string;
  user_id: string;
  attempt_id: string;
  question_id: string;
  given: string;
  is_correct: boolean;
  score: number;
  explanation: string;
  created_at: string;
}

export type MasteryBand = "unassessed" | "weak" | "medium" | "strong";

export interface TopicMasteryRow {
  id: string;
  user_id: string;
  attempt_id: string;
  topic_id: string;
  score: number;
  n_questions: number;
  band: MasteryBand;
  reason: string;
  created_at: string;
}

export interface PlanItem {
  id: string;
  date: string; // YYYY-MM-DD
  topic_id: string;
  topic_name: string;
  task_type: "read" | "practice" | "revisit" | "diagnostic";
  minutes: number;
  cited_sections: string[];
  completed?: boolean;
  description?: string;
}

export interface PlanRow {
  id: string;
  user_id: string;
  attempt_id: string | null;
  exam_date: string;
  minutes_per_day: number;
  items: PlanItem[];
  created_at: string;
}
