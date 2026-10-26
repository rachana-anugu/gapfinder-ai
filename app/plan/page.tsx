"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  Calendar,
  CheckSquare,
  Square,
  ArrowRight
} from "lucide-react";
import { PlanItem } from "@/lib/types/database";
import { CitationDrawer } from "@/components/CitationDrawer";

export default function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [examDate, setExamDate] = useState<string>("");
  const [minutesPerDay, setMinutesPerDay] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/plan");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        if (data.examDate) setExamDate(data.examDate);
        if (data.minutesPerDay) setMinutesPerDay(data.minutesPerDay);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examDate,
          minutesPerDay,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update plan");
      if (data.items) setItems(data.items);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleTask = async (itemId: string, currentVal?: boolean) => {
    const newVal = !currentVal;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed: newVal } : i))
    );

    try {
      await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, completed: newVal }),
      });
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  };

  // Group items by date
  const groupedByDate = new Map<string, PlanItem[]>();
  items.forEach((item) => {
    const list = groupedByDate.get(item.date) || [];
    list.push(item);
    groupedByDate.set(item.date, list);
  });

  const sortedDates = Array.from(groupedByDate.keys()).sort();

  const totalTasks = items.length;
  const completedTasks = items.filter((i) => i.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getTaskBadge = (type: string) => {
    switch (type) {
      case "read":
        return { label: "Read", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      case "practice":
        return { label: "Practice", color: "bg-red-500/20 text-red-300 border-red-500/30" };
      case "revisit":
        return { label: "Revisit", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
      case "diagnostic":
        return { label: "Diagnostic", color: "bg-slate-700 text-slate-300 border-slate-600" };
      default:
        return { label: "Study", color: "bg-slate-800 text-slate-300 border-slate-700" };
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CalendarDays className="h-7 w-7 text-brand-400" />
            Adaptive Revision Plan
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Prioritized by deterministic gap algorithms working backwards from your exam date.
          </p>
        </div>

        {totalTasks > 0 && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300">
              <strong className="text-white">{completedTasks}</strong> of {totalTasks} tasks done ({progressPercent}%)
            </span>
          </div>
        )}
      </div>

      {/* Scheduler Configuration Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleRegenerate} className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-300">
              Target Exam Date
            </label>
            <input
              type="date"
              required
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1.5 w-44">
            <label className="block text-xs font-semibold text-slate-300">
              Study Time / Day
            </label>
            <select
              value={minutesPerDay}
              onChange={(e) => setMinutesPerDay(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={30}>30 mins / day</option>
              <option value={45}>45 mins / day</option>
              <option value={60}>60 mins / day</option>
              <option value={90}>90 mins / day</option>
              <option value={120}>120 mins / day</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={updating || !examDate}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-500/20"
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Re-planning Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Update Schedule</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Plan Timeline */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Computing optimal revision intervals...</div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Revision Tasks Generated</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Select an exam date and daily study duration above to build your revision schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dayItems = groupedByDate.get(dateStr) || [];
            const dayMinutes = dayItems.reduce((sum, it) => sum + it.minutes, 0);
            const dateObj = new Date(dateStr + "T00:00:00");
            const formattedDate = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={dateStr}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Date Header */}
                <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-brand-400" />
                    <span className="font-bold text-white text-sm">{formattedDate}</span>
                    <span className="text-xs text-slate-500 font-mono">({dateStr})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{dayMinutes} mins scheduled</span>
                  </div>
                </div>

                {/* Day Tasks */}
                <div className="divide-y divide-slate-800/60 p-2">
                  {dayItems.map((item) => {
                    const badge = getTaskBadge(item.task_type);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl transition-all flex items-start gap-3.5 ${
                          item.completed
                            ? "bg-slate-950/30 opacity-60"
                            : "hover:bg-slate-850/50"
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleTask(item.id, item.completed)}
                          className="mt-0.5 text-brand-400 hover:text-brand-300 transition-transform active:scale-90"
                        >
                          {item.completed ? (
                            <CheckSquare className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-600" />
                          )}
                        </button>

                        {/* Task Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                            <span className="font-semibold text-white text-sm">
                              {item.topic_name}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              • {item.minutes}m
                            </span>
                          </div>

                          <p
                            className={`text-xs text-slate-300 leading-relaxed ${
                              item.completed ? "line-through text-slate-500" : ""
                            }`}
                          >
                            {item.description}
                          </p>

                          {/* Cited sections */}
                          {item.cited_sections && item.cited_sections.length > 0 && (
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              {item.cited_sections.map((sec, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() =>
                                    setDrawer({
                                      isOpen: true,
                                      citation: sec,
                                      content: `Cited study material for ${item.topic_name}. Review section: ${sec}`,
                                      page: 1,
                                      sectionPath: sec,
                                    })
                                  }
                                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 inline-flex items-center gap-1 transition-colors"
                                >
                                  <BookOpen className="h-3 w-3 text-brand-400" />
                                  <span>{sec}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
