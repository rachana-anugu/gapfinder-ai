import { runRetrievalEvaluation } from "./retrieval-hit-rate";
import { runGroundednessEvaluation } from "./groundedness";
import { runStudentSimulations } from "./simulated-students";

async function runAllEvaluations() {
  console.log("=========================================================");
  console.log("GAPFINDER AI - COMPLETE SYSTEM EVALUATION SUITE");
  console.log("=========================================================\n");

  console.log("1. EVALUATING RAG RETRIEVAL HIT RATE (22 BENCHMARK QUERIES)...");
  const retrieval = runRetrievalEvaluation();
  console.table(retrieval);

  console.log("\n2. EVALUATING QUESTION GROUNDEDNESS & VERIFICATION (20 QUESTIONS)...");
  const groundedness = await runGroundednessEvaluation();
  console.table(groundedness);

  console.log("\n3. EVALUATING SIMULATED STUDENT GAP RECOVERY (50 PROFILES)...");
  const simulated = runStudentSimulations(50);
  console.table(simulated);

  console.log("\n=========================================================");
  console.log("SUMMARY OF BENCHMARK TARGETS:");
  console.log(`- Retrieval Hit@5:           ${retrieval.hitAt5}% (Target: >85%)`);
  console.log(`- Retrieval MRR:             ${retrieval.mrr} (Target: >0.70)`);
  console.log(`- Citation Groundedness:     ${groundedness.citationGroundednessPct}% (Target: 100%)`);
  console.log(`- Verification Pass Rate:    ${groundedness.verificationPassPct}% (Target: >90%)`);
  console.log(`- Weak Topic Recovery Recall: ${simulated.recall}% (Target: >90%)`);
  console.log(`- Weak Topic Precision:      ${simulated.precision}% (Target: >90%)`);
  console.log("=========================================================\n");
}

runAllEvaluations().catch((err) => {
  console.error("Evaluation run failed:", err);
  process.exit(1);
});
