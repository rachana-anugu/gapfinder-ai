import Link from "next/link";
import { GraduationCap, ArrowRight, ShieldCheck, Cpu, Target, Calendar } from "lucide-react";

export default function HomePage() {
  return (
    <div className="py-12 space-y-16 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold">
          <GraduationCap className="h-4 w-4" />
          <span>Hackathon Edition • Grounded AI Diagnostics</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Find your knowledge gaps, <br />
          <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent">
            not hallucinated answers.
          </span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          GapFinder maps your course syllabus, quizzes you strictly from your uploaded notes and textbooks with page citations, and computes deterministic mastery bands and revision schedules.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
          >
            <span>Launch GapFinder AI</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all"
          >
            <span>View Demo Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Strict Grounding</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every question, explanation, and recommendation cites an exact section path and page number from your uploaded files. Refuses when unsupported.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Deterministic Scoring</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            The LLM never decides what you know. Pure TypeScript formulas compute mastery, difficulty weighting, recency decay, and weak/medium/strong bands.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Adaptive Revision Plan</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Greedy scheduler automatically plans your study slots working backwards from exam day, prioritizing weak topics and scheduling revisit intervals.
          </p>
        </div>
      </div>
    </div>
  );
}
