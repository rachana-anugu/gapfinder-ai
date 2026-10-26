"use client";

import { useState, useEffect } from "react";
import {
  Network,
  Sparkles,
  GitMerge,
  Edit2,
  AlertTriangle,
  FileText,
  ChevronRight,
  FolderTree,
  Loader2,
  RefreshCw,
  ArrowRight,
  Layers
} from "lucide-react";
import Link from "next/link";
import { CitationDrawer } from "@/components/CitationDrawer";

interface TopicItem {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  weight: number;
  chunk_count: number;
}

interface UncoveredChunk {
  id: string;
  section_path: string;
  page: number;
  content: string;
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [uncoveredChunks, setUncoveredChunks] = useState<UncoveredChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>("");

  // Edit modal state
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWeight, setEditWeight] = useState<number>(1.0);

  // Merge modal state
  const [mergingTopic, setMergingTopic] = useState<TopicItem | null>(null);
  const [targetTopicId, setTargetTopicId] = useState<string>("");

  // Citation drawer state
  const [drawerChunk, setDrawerChunk] = useState<{
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

  const fetchTopicsData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/topics");
      const data = await res.json();
      if (data.topics) {
        setTopics(data.topics);
        setUncoveredChunks(data.uncoveredChunks || []);
      }
    } catch (err) {
      console.error("Failed to load topics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopicsData();
  }, []);

  const handleGenerateTopics = async () => {
    try {
      setActionLoading(true);
      setActionStatus("Analyzing syllabus & generating structured topic tree...");
      const res = await fetch("/api/topics", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate topics");
      await fetchTopicsData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
      setActionStatus("");
    }
  };

  const handleAutoAssign = async () => {
    try {
      setActionLoading(true);
      setActionStatus("Computing cosine similarities & assigning chunks to topics...");
      const res = await fetch("/api/topics/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: 0.38 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign chunks");
      alert(data.message || "Chunks successfully assigned!");
      await fetchTopicsData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
      setActionStatus("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTopic) return;
    try {
      const res = await fetch("/api/topics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTopic.id,
          name: editName,
          description: editDesc,
          weight: editWeight,
        }),
      });
      if (res.ok) {
        setEditingTopic(null);
        await fetchTopicsData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveMerge = async () => {
    if (!mergingTopic || !targetTopicId) return;
    try {
      const res = await fetch("/api/topics/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTopicId: mergingTopic.id,
          targetTopicId,
        }),
      });
      if (res.ok) {
        setMergingTopic(null);
        setTargetTopicId("");
        await fetchTopicsData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Organize topics into parents and subtopics
  const rootTopics = topics.filter((t) => !t.parent_id);
  const subtopicsByParent = new Map<string, TopicItem[]>();
  topics.forEach((t) => {
    if (t.parent_id) {
      const existing = subtopicsByParent.get(t.parent_id) || [];
      existing.push(t);
      subtopicsByParent.set(t.parent_id, existing);
    }
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Network className="h-7 w-7 text-brand-400" />
            Syllabus Topic Map
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Topics extracted from your syllabus with calibrated weights and assigned knowledge chunks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleAutoAssign}
            disabled={actionLoading || topics.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Re-Assign Chunks</span>
          </button>
          <button
            onClick={handleGenerateTopics}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-brand-600/20 transition-all hover:scale-105"
          >
            {actionLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{topics.length === 0 ? "Generate Topic Tree" : "Regenerate Tree"}</span>
              </>
            )}
          </button>
          {topics.length > 0 && (
            <Link
              href="/quiz"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all"
            >
              <span>Take Quiz</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {actionLoading && (
        <div className="p-4 rounded-xl bg-brand-950/40 border border-brand-800 flex items-center gap-3 text-sm text-brand-300">
          <Loader2 className="h-5 w-5 animate-spin shrink-0 text-brand-400" />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* Main Topic Tree */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading topic tree...</div>
      ) : topics.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <FolderTree className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Topics Mapped Yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload your course syllabus under Ingestion, then click &quot;Generate Topic Tree&quot; to build your personalized topic hierarchy.
          </p>
          <button
            onClick={handleGenerateTopics}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/20"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate Topics from Uploaded Material</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tree column */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand-400" />
              Course Hierarchy ({topics.length} topics)
            </h2>

            <div className="space-y-3">
              {rootTopics.map((topic) => {
                const subtopics = subtopicsByParent.get(topic.id) || [];
                return (
                  <div
                    key={topic.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all hover:border-slate-700"
                  >
                    {/* Parent header */}
                    <div className="p-4 flex items-center justify-between bg-slate-900/90">
                      <div className="space-y-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-base truncate">
                            {topic.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-medium">
                            Weight: {topic.weight}x
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {topic.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-medium text-slate-300">
                          {topic.chunk_count} chunks
                        </span>
                        <button
                          onClick={() => {
                            setEditingTopic(topic);
                            setEditName(topic.name);
                            setEditDesc(topic.description);
                            setEditWeight(topic.weight);
                          }}
                          title="Rename / Edit topic"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setMergingTopic(topic);
                            setTargetTopicId(
                              topics.find((t) => t.id !== topic.id)?.id || ""
                            );
                          }}
                          title="Merge into another topic"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subtopics */}
                    {subtopics.length > 0 && (
                      <div className="border-t border-slate-800/80 bg-slate-950/40 p-3 space-y-2">
                        {subtopics.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60 ml-4 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <ChevronRight className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">
                                  {sub.name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {sub.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">
                                {sub.chunk_count} chunks
                              </span>
                              <button
                                onClick={() => {
                                  setEditingTopic(sub);
                                  setEditName(sub.name);
                                  setEditDesc(sub.description);
                                  setEditWeight(sub.weight);
                                }}
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Uncovered Material Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Uncovered Material ({uncoveredChunks.length})
              </h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-400">
                These chunks did not exceed the similarity threshold for any syllabus topic. They may represent out-of-scope notes, general appendices, or uncovered material.
              </p>

              {uncoveredChunks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg">
                  All uploaded chunks have been successfully mapped to syllabus topics.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {uncoveredChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-amber-500/40 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-amber-300 truncate max-w-[180px]">
                          {chunk.section_path}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          p. {chunk.page}
                        </span>
                      </div>
                      <p className="text-slate-400 line-clamp-2 text-[11px]">
                        {chunk.content}
                      </p>
                      <button
                        onClick={() =>
                          setDrawerChunk({
                            isOpen: true,
                            citation: `${chunk.section_path}, p. ${chunk.page}`,
                            content: chunk.content,
                            page: chunk.page,
                            sectionPath: chunk.section_path,
                          })
                        }
                        className="text-[11px] text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Inspect Chunk</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Topic</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Topic Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Weight (0.5 to 10.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={editWeight}
                  onChange={(e) => setEditWeight(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingTopic(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergingTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-brand-400" />
              Merge Topic
            </h3>
            <p className="text-xs text-slate-400">
              Merge &quot;<strong className="text-white">{mergingTopic.name}</strong>&quot; into another topic. All {mergingTopic.chunk_count} assigned chunks and subtopics will be moved to the target topic.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Topic
              </label>
              <select
                value={targetTopicId}
                onChange={(e) => setTargetTopicId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                {topics
                  .filter((t) => t.id !== mergingTopic.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.chunk_count} chunks)
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMergingTopic(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMerge}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citation Drawer */}
      <CitationDrawer
        isOpen={drawerChunk.isOpen}
        onClose={() => setDrawerChunk((prev) => ({ ...prev, isOpen: false }))}
        citation={drawerChunk.citation}
        content={drawerChunk.content}
        page={drawerChunk.page}
        sectionPath={drawerChunk.sectionPath}
      />
    </div>
  );
}
