"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  BookOpen,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  HelpCircle,
  FileText,
  ShieldCheck,
  Compass,
  ArrowRight
} from "lucide-react";
import { CitationDrawer } from "@/components/CitationDrawer";
import { RetrievedChunk } from "@/lib/rag/retrieve";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  refused?: boolean;
  citations?: string[];
  key_takeaways?: string[];
  chunks?: RetrievedChunk[];
  similarity?: number;
  threshold?: number;
}

function AssistantChat() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          if (initialTopic) {
            const match = data.topics.find((t: any) =>
              t.name.toLowerCase().includes(initialTopic.toLowerCase())
            );
            if (match) setSelectedTopicId(match.id);
          }
        }
      })
      .catch(console.error);

    // Initial greeting message
    setMessages([
      {
        id: "msg-welcome",
        role: "assistant",
        content: initialTopic
          ? `Hello! I'm your grounded Explain Assistant. You selected "${initialTopic}". What would you like to review from your course notes on this topic?`
          : "Hello! I'm your GapFinder Explain Assistant. Ask me anything about your course materials. Every explanation is grounded strictly in your uploaded notes and textbooks with page citations.",
        citations: [],
      },
    ]);
  }, [initialTopic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          topicId: selectedTopicId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        refused: data.refused,
        citations: data.citations || [],
        key_takeaways: data.key_takeaways || [],
        chunks: data.chunks || [],
        similarity: data.highestSimilarity,
        threshold: data.threshold,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "An error occurred while searching your course files. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    "Explain Deadlock Detection vs Deadlock Avoidance",
    "How does the Banker's Algorithm allocate resources safely?",
    "What is the difference between paging and segmentation?",
    "What is quantum computing superposition?", // Test refusal query
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto h-[85vh] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-400" />
            Explain-This-Topic AI
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Answers are strictly limited to your uploaded course materials with exact page citations.
          </p>
        </div>

        {/* Topic Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Search All Course Materials</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 sm:p-5 space-y-3 ${
                  isUser
                    ? "bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-500/10"
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-lg"
                }`}
              >
                {/* Refusal State: Not Found in Material */}
                {msg.refused ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Not Found in Your Material</span>
                      </div>
                      <p className="leading-relaxed">
                        I couldn&apos;t find this in your uploaded material. To prevent hallucinations and enforce strict academic grounding, GapFinder only answers concepts verified in your course files.
                      </p>
                      {msg.similarity !== undefined && msg.threshold !== undefined && (
                        <div className="pt-1 text-[11px] font-mono text-amber-400">
                          Retrieval confidence: {msg.similarity.toFixed(2)} &lt; threshold {msg.threshold.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Tip: Try rephrasing with terms used in your lecture slides, or upload the missing chapter in the Upload section.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Content */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Key Takeaways */}
                    {msg.key_takeaways && msg.key_takeaways.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1">
                        <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider block">
                          Key Takeaways
                        </span>
                        <ul className="space-y-1 text-xs text-slate-300">
                          {msg.key_takeaways.map((point, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1.5">
                              <span className="text-brand-400 font-bold">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Verified Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[11px] text-slate-400 font-medium mr-1">
                          Source Citations:
                        </span>
                        {msg.citations.map((cite, cIdx) => {
                          const chunk = msg.chunks?.[cIdx] || msg.chunks?.[0];
                          return (
                            <button
                              key={cIdx}
                              onClick={() => {
                                if (chunk) {
                                  setDrawer({
                                    isOpen: true,
                                    citation: cite,
                                    content: chunk.content,
                                    page: chunk.page,
                                    sectionPath: chunk.section_path,
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-950/60 hover:bg-brand-900/60 border border-brand-800/80 text-brand-300 hover:text-white text-xs font-semibold transition-colors"
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>{cite}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none p-4 flex items-center space-x-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
              <span>Hybrid searching vector chunks and verifying facts...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Suggested Queries
          </span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-xl"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your uploaded materials..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-colors shadow-md shadow-brand-500/20"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

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

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-slate-500 text-sm">Loading Explain Assistant...</div>}>
      <AssistantChat />
    </Suspense>
  );
}
