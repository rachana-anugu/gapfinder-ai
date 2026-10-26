"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  CalendarDays,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Eye,
  FileQuestion,
  Sparkles,
  Layers
} from "lucide-react";
import Link from "next/link";
import { CitationDrawer } from "@/components/CitationDrawer";
import { MasteryBand } from "@/lib/types/database";

interface DiagnosedTopic {
  id: string;
  name: string;
  parent_id: string | null;
  weight: number;
  score: number;
  percentage: number;
  n_questions: number;
  band: MasteryBand;
  reason: string;
  missed_sections: string[];
}

interface EvidenceItem {
  answer_id: string;
  question_id: string;
  topic_id: string;
  topic_name: string;
  stem: string;
  given: string;
  is_correct: boolean;
  score: number;
  explanation: string;
  citation: string;
  page: number;
  section_path: string;
  content: string;
}

interface GapReportData {
  attemptId: string | null;
  topics: DiagnosedTopic[];
  evidence: EvidenceItem[];
  overallScore: number;
  totalAssessed: number;
  weakCount: number;
  mediumCount: number;
  strongCount: number;
  unassessedCount: number;
}

export default function AttemptReportPage({
  params,
}: {
  params: Promise<{ attemptId?: string }>;
}) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;
  const router = useRouter();

  const [data, setData] = useState<GapReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Evidence modal state
  const [activeEvidenceTopic, setActiveEvidenceTopic] = useState<string | null>(null);

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
    const url = attemptId ? `/api/gaps?attemptId=${attemptId}` : "/api/gaps";
    fetch(url)
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return <div className="p-16 text-center text-slate-500">Computing deterministic knowledge diagnosis...</div>;
  }

  if (!data || data.topics.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto">
        <FileCheck2 className="h-12 w-12 text-slate-600 mx-auto" />
        <h2 className="text-xl font-bold text-white">No Diagnostic Data Found</h2>
        <p className="text-sm text-slate-400">
          Take a diagnostic quiz to test your material and compute your knowledge bands.
        </p>
        <Link
          href="/quiz"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm"
        >
          <span>Take a Quiz Now</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const weakTopics = data.topics.filter((t) => t.band === "weak");
  const mediumTopics = data.topics.filter((t) => t.band === "medium");
  const strongTopics = data.topics.filter((t) => t.band === "strong");
  const unassessedTopics = data.topics.filter((t) => t.band === "unassessed");

  const topicEvidence = activeEvidenceTopic
    ? data.evidence.filter((e) => e.topic_id === activeEvidenceTopic)
    : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header & Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Deterministic Knowledge Diagnosis</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Diagnostic Gap Report
          </h1>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Diagnosed by deterministic TypeScript algorithms evaluating difficulty weights and recency decay.
            The LLM writes verbal justifications without modifying your mastery band.
          </p>
        </div>

        {/* Readiness Gauge */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl shrink-0">
          <div className="text-center">
            <span className="text-4xl font-black text-white tracking-tight">
              {data.overallScore}%
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              Course Readiness
            </span>
          </div>
          <div className="h-10 w-[1px] bg-slate-800" />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>{data.weakCount} Weak</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>{data.mediumCount} Medium</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{data.strongCount} Strong</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
          >
            <CalendarDays className="h-4 w-4" />
            <span>Build Prioritized Revision Plan</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Link
          href="/quiz"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium border border-slate-700"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Take Another Quiz</span>
        </Link>
      </div>

      {/* Categorized Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Weak Topics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-950/30 border border-red-900/60">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertOctagon className="h-4 w-4" />
              <span>Weak Topics (&lt;50%)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300">
              {weakTopics.length}
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
              No weak topics identified!
            </div>
          ) : (
            <div className="space-y-3">
              {weakTopics.map((topic) => (
                <TopicDiagnosisCard
                  key={topic.id}
                  topic={topic}
                  onViewEvidence={() => setActiveEvidenceTopic(topic.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Medium Topics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/30 border border-amber-900/60">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Medium Topics (50-74%)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">
              {mediumTopics.length}
            </span>
          </div>

          {mediumTopics.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
              No medium topics in this band.
            </div>
          ) : (
            <div className="space-y-3">
              {mediumTopics.map((topic) => (
                <TopicDiagnosisCard
                  key={topic.id}
                  topic={topic}
                  onViewEvidence={() => setActiveEvidenceTopic(topic.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Strong Topics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/60">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Strong Topics (≥75%)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
              {strongTopics.length}
            </span>
          </div>

          {strongTopics.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
              Keep practicing to reach strong mastery.
            </div>
          ) : (
            <div className="space-y-3">
              {strongTopics.map((topic) => (
                <TopicDiagnosisCard
                  key={topic.id}
                  topic={topic}
                  onViewEvidence={() => setActiveEvidenceTopic(topic.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unassessed Topics Section */}
      {unassessedTopics.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span>Unassessed Topics ({unassessedTopics.length})</span>
            </div>
            <span className="text-xs text-slate-400">
              Requires at least 2 questions to formulate an evidence-backed band
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {unassessedTopics.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm truncate">{t.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {t.n_questions} Qs
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-snug">{t.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Modal */}
      {activeEvidenceTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Eye className="h-5 w-5 text-brand-400" />
                  Diagnostic Evidence
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Questions, given answers and cited source chunks for this topic
                </p>
              </div>
              <button
                onClick={() => setActiveEvidenceTopic(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {topicEvidence.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No direct question records found for this topic.
                </div>
              ) : (
                topicEvidence.map((item, idx) => (
                  <div
                    key={item.answer_id || idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {item.stem}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          item.is_correct
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {item.is_correct ? "Correct" : "Incorrect"}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-slate-400">
                        <span className="font-semibold text-slate-300">Your Answer:</span>{" "}
                        {item.given}
                      </p>
                      <p className="text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-400">Diagnostic Note:</span>{" "}
                        {item.explanation}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {item.section_path}, p. {item.page}
                      </span>
                      <button
                        onClick={() =>
                          setDrawer({
                            isOpen: true,
                            citation: item.citation,
                            content: item.content,
                            page: item.page,
                            sectionPath: item.section_path,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-xs font-medium"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Inspect Source Chunk</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Citation Drawer */}
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

function TopicDiagnosisCard({
  topic,
  onViewEvidence,
}: {
  topic: DiagnosedTopic;
  onViewEvidence: () => void;
}) {
  const bandColors = {
    weak: "border-red-900/60 hover:border-red-700/80 bg-red-950/15",
    medium: "border-amber-900/60 hover:border-amber-700/80 bg-amber-950/15",
    strong: "border-emerald-900/60 hover:border-emerald-700/80 bg-emerald-950/15",
    unassessed: "border-slate-800 bg-slate-900/40",
  };

  const progressColors = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
    unassessed: "bg-slate-600",
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all space-y-3 ${
        bandColors[topic.band]
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-white text-sm leading-snug">
          {topic.name}
        </h4>
        <span className="font-mono text-sm font-bold text-white shrink-0">
          {topic.percentage}%
        </span>
      </div>

      {/* Mini Progress */}
      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${progressColors[topic.band]}`}
          style={{ width: `${topic.percentage}%` }}
        />
      </div>

      {/* Verbal Diagnostic Reason from LLM based strictly on facts */}
      <p className="text-xs text-slate-300 leading-relaxed">
        {topic.reason}
      </p>

      {/* Footer info */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{topic.n_questions} questions evaluated</span>
        <button
          onClick={onViewEvidence}
          className="text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1"
        >
          <Eye className="h-3 w-3" />
          <span>View Evidence</span>
        </button>
      </div>
    </div>
  );
}
