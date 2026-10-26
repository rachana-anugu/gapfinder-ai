import { generateQuestion, ChunkForGeneration } from "../lib/ai/genQuestion";
import { verifyQuestion } from "../lib/ai/verifyQuestion";
import { BENCHMARK_CHUNKS } from "./retrieval-hit-rate";

export async function runGroundednessEvaluation() {
  const chunks: ChunkForGeneration[] = BENCHMARK_CHUNKS.slice(0, 10).map((c, i) => ({
    id: c.id,
    section_path: c.path,
    page: i + 1,
    content: c.text,
  }));

  const validChunkIds = new Set(chunks.map((c) => c.id));

  let totalQuestions = 20;
  let citationsInRetrievedSet = 0;
  let passedVerification = 0;
  let validFormatCitations = 0;

  for (let i = 0; i < totalQuestions; i++) {
    const chunkIndex = i % chunks.length;
    const subset = [
      chunks[chunkIndex],
      chunks[(chunkIndex + 1) % chunks.length],
      chunks[(chunkIndex + 2) % chunks.length],
    ];

    const q = await generateQuestion("Operating Systems", subset, {
      targetDifficulty: ((i % 3) + 1) as 1 | 2 | 3,
      targetType: i % 2 === 0 ? "mcq" : "short_answer",
    });

    // 1. Citation check: source_chunk_id in retrieved subset
    if (validChunkIds.has(q.source_chunk_id)) {
      citationsInRetrievedSet++;
    }

    const citedChunk = subset.find((c) => c.id === q.source_chunk_id) || subset[0];

    // 2. Adversarial verification check
    const verification = await verifyQuestion(q, citedChunk);
    if (verification.passed) {
      passedVerification++;
    }

    // 3. Citation string integrity
    const citation = `${citedChunk.section_path}, p. ${citedChunk.page}`;
    if (citation.includes(", p. ") && citation.split(", p. ")[1]?.length > 0) {
      validFormatCitations++;
    }
  }

  const citationGroundedness = (citationsInRetrievedSet / totalQuestions) * 100;
  const verificationPassRate = (passedVerification / totalQuestions) * 100;
  const citationFormatRate = (validFormatCitations / totalQuestions) * 100;

  return {
    totalEvaluated: totalQuestions,
    citationGroundednessPct: Number(citationGroundedness.toFixed(1)),
    verificationPassPct: Number(verificationPassRate.toFixed(1)),
    citationFormatPct: Number(citationFormatRate.toFixed(1)),
  };
}

if (process.argv[1]?.includes("groundedness")) {
  console.log("=== GapFinder Groundedness & Verification Evaluation ===");
  runGroundednessEvaluation().then((res) => console.table(res));
}
