"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight,
  Loader2,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { CitationDrawer } from "@/components/CitationDrawer";

interface TopicOption {
  id: string;
  name: string;
  chunk_count: number;
}

interface QuizQuestion {
  id: string;
  topic_id: string;
  topic_name: string;
  type: "mcq" | "short_answer";
  stem: string;
  options: string[];
  difficulty: 1 | 2 | 3;
  citation: string;
}

interface QuestionFeedback {
  is_correct: boolean;
  score: number;
  explanation: string;
  cited_quote: string;
  citation: string;
  sourceChunkContent: string;
  sectionPath: string;
  page: number;
  isCompleted: boolean;
}

export default function QuizPage() {
  const router = useRouter();

  // Setup state
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [loadingTopics, setLoadingTopics] = useState(true);

  // Active quiz state
  const [isStarted, setIsStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answering state
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [shortAnswerText, setShortAnswerText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Citation drawer state
  const [drawer, setDrawer] = useState<{
    isOpen: boolean;
    citation: string;
    content: string;
    page: number;
    sectionPath: string;
  }>({
    isOpen: false,
    citation: "",
    content: "",
    page: 1,
    sectionPath: "",
  });

  useEffect(() => {
    fetch("/api/topics")
      .then((res) => res.json())
      .then((data) => {
        if (data.topics) {
          setTopics(data.topics);
          setSelectedTopicIds(data.topics.map((t: any) => t.id));
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTopics(false));
  }, []);

  const handleToggleTopic = (id: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTopicIds.length === topics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(topics.map((t) => t.id));
    }
  };

  const handleStartQuiz = async () => {
    if (selectedTopicIds.length === 0) {
      alert("Please select at least one topic.");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicIds: selectedTopicIds,
          questionCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz");

      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setIsStarted(true);
      setFeedback(null);
      setSelectedOption("");
      setShortAnswerText("");
      setAnsweredCount(0);
      setTotalCorrect(0);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const currentQ = questions[currentIndex];
    const given = currentQ.type === "mcq" ? selectedOption : shortAnswerText.trim();

    if (!given) {
      alert("Please choose or enter an answer first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: currentQ.id,
          givenAnswer: given,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to evaluate answer");

      setFeedback(data);
      setAnsweredCount((prev) => prev + 1);
      if (data.is_correct) {
        setTotalCorrect((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption("");
      setShortAnswerText("");
      setFeedback(null);
    }
  };

  const handleFinishQuiz = () => {
    if (attemptId) {
      router.push(`/report/${attemptId}`);
    } else {
      router.push("/report");
    }
  };

  const currentQuestion = questions[currentIndex];

  const difficultyStars = (diff: 1 | 2 | 3) => {
    return "★".repeat(diff) + "☆".repeat(3 - diff);
  };

  // View: Setup Configuration
  if (!isStarted) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <HelpCircle className="h-7 w-7 text-brand-400" />
            Diagnostic Quiz Setup
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Questions are generated strictly from your uploaded course notes and textbook chapters.
            No questions are drawn from general model memory.
          </p>
        </div>

        {loadingTopics ? (
          <div className="p-12 text-center text-slate-500">Loading syllabus topics...</div>
        ) : topics.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <p className="text-white font-semibold">No syllabus topics detected</p>
            <p className="text-sm text-slate-400">
              Please upload course material and generate your topic tree before starting a diagnostic quiz.
            </p>
            <button
              onClick={() => router.push("/topics")}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold"
            >
              Go to Topics
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Topic selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-400" />
                  Select Topics to Assess ({selectedTopicIds.length} of {topics.length} selected)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                >
                  {selectedTopicIds.length === topics.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {topics.map((topic) => {
                  const isChecked = selectedTopicIds.includes(topic.id);
                  return (
                    <div
                      key={topic.id}
                      onClick={() => handleToggleTopic(topic.id)}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? "bg-brand-950/40 border-brand-500/80 text-white shadow-sm"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="font-medium truncate pr-2">{topic.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                        {topic.chunk_count} chunks
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Length selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-white">
                Quiz Length: <span className="text-brand-400 font-bold">{questionCount} Questions</span>
              </label>
              <div className="flex items-center gap-3">
                {[5, 8, 10, 12].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      questionCount === cnt
                        ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {cnt} Qs
                  </button>
                ))}
              </div>
            </div>

            {/* Launch button */}
            <button
              onClick={handleStartQuiz}
              disabled={starting || selectedTopicIds.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-600/25 hover:scale-[1.01]"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating & Verifying Grounded Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Start Grounded Diagnostic Quiz</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // View: Active Quiz Runner
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Header & Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
            {currentQuestion?.topic_name}
          </span>
          <span className="text-amber-400 font-mono">
            Diff {difficultyStars(currentQuestion?.difficulty || 1)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-indigo-400 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Stem */}
        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-brand-400">
            {currentQuestion?.type === "mcq" ? "Multiple Choice" : "Short Answer"}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
            {currentQuestion?.stem}
          </h2>
        </div>

        {/* Options for MCQ */}
        {currentQuestion?.type === "mcq" && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedOption === option;
              const isSubmitted = !!feedback;

              return (
                <div
                  key={idx}
                  onClick={() => !isSubmitted && setSelectedOption(option)}
                  className={`p-4 rounded-xl border transition-all flex items-start gap-3 ${
                    !isSubmitted
                      ? isSelected
                        ? "bg-brand-950/40 border-brand-500 text-white shadow-md shadow-brand-500/10 cursor-pointer"
                        : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer"
                      : isSelected
                      ? feedback.is_correct
                        ? "bg-emerald-950/40 border-emerald-500 text-white"
                        : "bg-red-950/40 border-red-500 text-white"
                      : "bg-slate-950/30 border-slate-850 text-slate-500 opacity-60"
                  }`}
                >
                  <span
                    className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-brand-600 text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm font-medium leading-relaxed">{option}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea for Short Answer */}
        {currentQuestion?.type === "short_answer" && (
          <div>
            <textarea
              rows={4}
              disabled={!!feedback}
              value={shortAnswerText}
              onChange={(e) => setShortAnswerText(e.target.value)}
              placeholder="Type your explanation based on your notes..."
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />
          </div>
        )}

        {/* Submit Button (before answer feedback) */}
        {!feedback && (
          <button
            onClick={handleSubmitAnswer}
            disabled={
              submitting ||
              (currentQuestion?.type === "mcq" && !selectedOption) ||
              (currentQuestion?.type === "short_answer" && !shortAnswerText.trim())
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Evaluating against source chunk...</span>
              </>
            ) : (
              <span>Submit Answer</span>
            )}
          </button>
        )}

        {/* Feedback Display */}
        {feedback && (
          <div
            className={`p-5 rounded-xl border space-y-4 animate-in fade-in duration-200 ${
              feedback.is_correct
                ? "bg-emerald-950/30 border-emerald-800/80 text-emerald-200"
                : "bg-red-950/30 border-red-800/80 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-base">
              {feedback.is_correct ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span>Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span>Knowledge Gap Identified</span>
                </>
              )}
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">
              {feedback.explanation}
            </p>

            {/* Grounded Citation */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Verified in your course material:</span>
              <button
                type="button"
                onClick={() =>
                  setDrawer({
                    isOpen: true,
                    citation: feedback.citation,
                    content: feedback.sourceChunkContent,
                    page: feedback.page,
                    sectionPath: feedback.sectionPath,
                  })
                }
                className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold bg-brand-950/60 border border-brand-800/80 px-2.5 py-1 rounded-lg transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{feedback.citation}</span>
              </button>
            </div>

            {/* Next / Finish Button */}
            <div className="pt-3">
              {isLastQuestion ? (
                <button
                  onClick={handleFinishQuiz}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01]"
                >
                  <Award className="h-4 w-4" />
                  <span>View Diagnostic Gap Report</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm shadow transition-colors"
                >
                  <span>Next Question</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Citation Drawer Modal */}
      <CitationDrawer
        isOpen={drawer.isOpen}
        onClose={() => setDrawer((prev) => ({ ...prev, isOpen: false }))}
        citation={drawer.citation}
        content={drawer.content}
        page={drawer.page}
        sectionPath={drawer.sectionPath}
      />
    </div>
  );
}
