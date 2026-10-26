"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Compass,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  BookOpen,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Database,
  HelpCircle,
  Network,
  RotateCcw,
  Layers,
  GraduationCap
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface DashboardData {
  stats: {
    documents: number;
    chunks: number;
    topics: number;
    attempts: number;
    overallScore: number;
    weakCount: number;
    mediumCount: number;
    strongCount: number;
  };
  nextAction: {
    title: string;
    description: string;
    actionLink: string;
    actionText: string;
    badge: string;
  };
  trendData: any[];
  topicNames: string[];
  recentTopics: any[];
}

const LINE_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#8b5cf6"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-16 text-center text-slate-500 text-sm">Loading knowledge dashboard...</div>;
  }

  const stats = data?.stats || {
    documents: 0,
    chunks: 0,
    topics: 0,
    attempts: 0,
    overallScore: 0,
    weakCount: 0,
    mediumCount: 0,
    strongCount: 0,
  };

  const nextAction = data?.nextAction;
  const trendData = data?.trendData || [];
  const topicNames = data?.topicNames || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Compass className="h-7 w-7 text-brand-400" />
            Knowledge Dashboard
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Continuous diagnostic tracking of your course material mastery.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/quiz"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Take Diagnostic Quiz</span>
          </Link>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness Score */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overall Readiness
            </span>
            <div className="text-3xl font-extrabold text-white mt-1">
              {stats.overallScore}%
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Across all evaluated syllabus units
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-lg">
            <GraduationCap className="h-6 w-6" />
          </div>
        </div>

        {/* Critical Knowledge Gaps */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Critical Gaps (&lt;50%)
            </span>
            <div className="text-3xl font-extrabold text-red-400 mt-1">
              {stats.weakCount}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Topics requiring immediate revision
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-lg">
            <AlertOctagon className="h-6 w-6" />
          </div>
        </div>

        {/* Course Topics Mapped */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mapped Topics
            </span>
            <div className="text-3xl font-extrabold text-white mt-1">
              {stats.topics}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {stats.chunks} vector chunks indexed
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Network className="h-6 w-6" />
          </div>
        </div>

        {/* Quiz Attempts */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Quizzes Attempted
            </span>
            <div className="text-3xl font-extrabold text-white mt-1">
              {stats.attempts}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {stats.strongCount} strong topics verified
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Next Recommended Action Banner */}
      {nextAction && (
        <div className="bg-gradient-to-r from-brand-950/70 via-slate-900 to-indigo-950/60 border border-brand-800/80 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {nextAction.badge}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Recommended Next Step
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {nextAction.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              {nextAction.description}
            </p>
          </div>

          <Link
            href={nextAction.actionLink}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-md transition-all hover:scale-105 shrink-0"
          >
            <span>{nextAction.actionText}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Mastery Trend Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-400" />
              Mastery Progress Across Attempts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks topic score evolution across quizzes incorporating difficulty weighting and recency decay.
            </p>
          </div>
          {stats.attempts > 0 && (
            <Link
              href="/report"
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              View Full Gap Report →
            </Link>
          )}
        </div>

        {trendData.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm space-y-2">
            <p>No historical quiz attempts recorded yet.</p>
            <p className="text-xs text-slate-600">
              Take quizzes to plot your diagnostic mastery trajectory over time.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="attemptLabel" stroke="#64748b" textAnchor="middle" />
                <YAxis domain={[0, 100]} stroke="#64748b" unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "12px" }} />
                {topicNames.map((topicName, idx) => (
                  <Line
                    key={topicName}
                    type="monotone"
                    dataKey={topicName}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/upload"
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group space-y-2"
        >
          <div className="flex items-center justify-between text-brand-400">
            <Database className="h-5 w-5" />
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-semibold text-white text-base">Course Materials</h4>
          <p className="text-xs text-slate-400">
            Ingest syllabus, notes, textbooks, and past papers with page preservation.
          </p>
        </Link>

        <Link
          href="/plan"
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group space-y-2"
        >
          <div className="flex items-center justify-between text-indigo-400">
            <CalendarDays className="h-5 w-5" />
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-semibold text-white text-base">Adaptive Study Plan</h4>
          <p className="text-xs text-slate-400">
            Review your day-by-day revision schedule with checkable tasks and citations.
          </p>
        </Link>

        <Link
          href="/assistant"
          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group space-y-2"
        >
          <div className="flex items-center justify-between text-emerald-400">
            <Sparkles className="h-5 w-5" />
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-semibold text-white text-base">Explain-This-Topic AI</h4>
          <p className="text-xs text-slate-400">
            Ask targeted questions answered strictly from your notes with citations.
          </p>
        </Link>
      </div>
    </div>
  );
}
