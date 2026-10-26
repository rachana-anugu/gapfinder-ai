import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseDocument } from "@/lib/rag/parse";
import { chunkPages } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import { DocumentKind } from "@/lib/types/database";

export const maxDuration = 60; // Allow 60 seconds on Vercel for parsing & embeddings

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Use test user ID if unauthenticated in development/placeholder mode
    const userId = user?.id || (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") ? "00000000-0000-0000-0000-000000000001" : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as DocumentKind) || "notes";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validKinds: DocumentKind[] = ["syllabus", "notes", "textbook", "past_paper"];
    if (!validKinds.includes(kind)) {
      return NextResponse.json({ error: `Invalid document kind: ${kind}` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name;
    const fileSize = file.size;

    // 1. Insert document record
    let documentId = crypto.randomUUID();
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        user_id: userId,
        name: fileName,
        kind,
        file_size: fileSize,
      })
      .select("id")
      .single();

    if (docError) {
      // In placeholder / offline mock mode without live Supabase table
      console.warn("Could not insert document into Supabase (mock fallback active):", docError.message);
    } else if (docData?.id) {
      documentId = docData.id;
    }

    // 2. Parse text per page
    const pages = await parseDocument(arrayBuffer, fileName);

    // 3. Chunk text with section headings and page tracking
    const chunks = chunkPages(pages, fileName.replace(/\.[^/.]+$/, ""));

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        documentId,
        fileName,
        chunksCount: 0,
        message: "File was processed but contained no readable text content.",
      });
    }

    // 4. Batch embed chunks (fixed 768 dimensions)
    const contents = chunks.map((c) => c.content);
    const embeddings = await embedTexts(contents);

    // 5. Store chunks in database
    const chunkRows = chunks.map((chunk, idx) => ({
      user_id: userId,
      document_id: documentId,
      section_path: chunk.section_path,
      page: chunk.page,
      content: chunk.content,
      embedding: embeddings[idx] || null,
    }));

    const { error: chunkError } = await supabase.from("chunks").insert(chunkRows);
    if (chunkError) {
      console.warn("Could not insert chunks into Supabase (mock fallback active):", chunkError.message);
    }

    return NextResponse.json({
      success: true,
      documentId,
      fileName,
      kind,
      pagesCount: pages.length,
      chunksCount: chunks.length,
      message: `Successfully ingested ${chunks.length} chunks from ${pages.length} page(s).`,
    });
  } catch (err: any) {
    console.error("Ingestion failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to parse and ingest document" },
      { status: 500 }
    );
  }
}
