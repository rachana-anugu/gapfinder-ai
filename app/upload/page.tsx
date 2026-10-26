"use client";

import { useState, useEffect, useRef } from "react";
import { DocumentKind } from "@/lib/types/database";
import {
  UploadCloud,
  FileText,
  BookOpen,
  FileQuestion,
  GraduationCap,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Database
} from "lucide-react";
import Link from "next/link";

interface DocItem {
  id: string;
  name: string;
  kind: DocumentKind;
  file_size: number;
  chunks_count: number;
  created_at: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DocumentKind>("notes");
  const [uploading, setUploading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);
    setProgressStep("Reading and parsing document pages (unpdf)...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      setProgressStep("Chunking with heading hierarchy & generating 768-dim embeddings...");

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setProgressStep("Storing chunks in vector database...");
      setMessage({
        type: "success",
        text: `Success! ${result.message || `Ingested ${result.chunksCount} chunks.`}`,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocuments();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An error occurred during ingestion" });
    } finally {
      setUploading(false);
      setProgressStep("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document and all its chunks?")) return;

    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const kindOptions: { id: DocumentKind; label: string; icon: any; desc: string }[] = [
    {
      id: "syllabus",
      label: "Syllabus",
      icon: GraduationCap,
      desc: "Course syllabus defining topic hierarchy and unit weightings",
    },
    {
      id: "notes",
      label: "Class Notes",
      icon: FileText,
      desc: "Lecture notes and student summaries with section headings",
    },
    {
      id: "textbook",
      label: "Textbook Chapter",
      icon: BookOpen,
      desc: "Reference textbook materials, explanations and diagrams",
    },
    {
      id: "past_paper",
      label: "Past Exam Paper",
      icon: FileQuestion,
      desc: "Previous year exam questions to calibrate difficulty & style",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Document Ingestion</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Upload your syllabus, lecture notes, textbook chapters and past papers. GapFinder extracts
          exact page numbers and heading paths for faithful citations.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleUpload} className="space-y-6">
          {/* Document Kind Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-3">
              Select Document Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {kindOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = kind === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setKind(opt.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-brand-600/20 border-brand-500 text-white shadow-md shadow-brand-500/10"
                        : "bg-slate-800/40 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-brand-400" : "text-slate-400"}`} />
                      <span className="font-semibold text-sm">{opt.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              file
                ? "border-brand-500/60 bg-brand-950/20"
                : "border-slate-750 hover:border-slate-600 bg-slate-950/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-brand-400">
                <UploadCloud className="h-6 w-6" />
              </div>
              {file ? (
                <div>
                  <p className="font-semibold text-white text-sm">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Click or drop to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-white text-sm">
                    Drag and drop your file here, or <span className="text-brand-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports PDF (with page numbers via unpdf), Markdown (.md), and Text (.txt)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress / Status feedback */}
          {uploading && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center space-x-3 text-sm text-slate-200">
              <Loader2 className="h-5 w-5 animate-spin text-brand-400 shrink-0" />
              <div>
                <p className="font-medium">Processing Document</p>
                <p className="text-xs text-slate-400 mt-0.5">{progressStep}</p>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`p-4 rounded-xl text-sm flex items-start space-x-3 ${
                message.type === "success"
                  ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                  : "bg-red-950/40 border border-red-800 text-red-300"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-600/20"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ingesting Knowledge Chunks...</span>
              </>
            ) : (
              <>
                <span>Ingest & Vectorize Document</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Uploaded Documents List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-brand-400" />
            Knowledge Base Materials ({documents.length})
          </h2>
          {documents.length > 0 && (
            <Link
              href="/topics"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 bg-brand-950/50 hover:bg-brand-900/50 border border-brand-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>Next: Map Topic Tree</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {loadingDocs ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading materials...</div>
        ) : documents.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <FileText className="h-10 w-10 mx-auto text-slate-600 mb-2" />
            <p className="font-medium text-white">No documents uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload your syllabus or lecture notes above to start mapping topics and diagnosing knowledge gaps.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden shadow-lg">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex items-center justify-between hover:bg-slate-850/40 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-brand-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {doc.kind.replace("_", " ")}
                      </span>
                      <span>•</span>
                      <span>{doc.chunks_count} chunks</span>
                      <span>•</span>
                      <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  title="Delete document"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors ml-4"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
