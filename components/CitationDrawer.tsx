"use client";

import { X, BookOpen, Hash, FileText } from "lucide-react";

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: string;
  content: string;
  page?: number;
  sectionPath?: string;
}

export function CitationDrawer({
  isOpen,
  onClose,
  citation,
  content,
  page,
  sectionPath,
}: CitationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col transform transition-transform animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2 text-brand-400">
            <BookOpen className="h-5 w-5" />
            <span className="font-bold text-sm tracking-wide uppercase text-white">
              Source Material Citation
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Metadata pill */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-400">
              <Hash className="h-3.5 w-3.5" />
              <span>Location Reference</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {citation || (sectionPath ? `${sectionPath}, p. ${page || 1}` : "Source Chunk")}
            </p>
            {page && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                Page {page}
              </span>
            )}
          </div>

          {/* Source chunk text */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5" />
              <span>Extracted Source Text</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              {content || "No source text provided for this chunk."}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-400 flex items-center justify-between">
          <span>Faithfully retrieved from student documents</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
