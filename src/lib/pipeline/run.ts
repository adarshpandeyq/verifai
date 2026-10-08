import { db } from "@/db";
import { verifications } from "@/db/schema";
import type { PipelineStageId, VerificationRecord, VerifyEvent } from "@/lib/types";
import { analyzeText } from "@/lib/pipeline/text-analysis";
import { analyzeImage, makeThumbnail } from "@/lib/pipeline/image-analysis";
import { compareTextAndImage } from "@/lib/pipeline/consistency";
import { retrieveEvidence, type EvidenceBundle } from "@/lib/pipeline/evidence";
import { classifyVerification, maybeRefineWithModel } from "@/lib/pipeline/classify";
import { sleep } from "@/lib/pipeline/math";

export async function runVerificationPipeline(input: {
  claim: string;
  image: Buffer | null;
  emit: (event: VerifyEvent) => void;
}): Promise<VerificationRecord> {
  const { claim, image, emit } = input;

  const runStage = async (id: PipelineStageId, detail: string, work: () => Promise<void> | void) => {
    emit({ type: "stage", id, status: "running", detail });
    await work();
    await sleep(240);
    emit({ type: "stage", id, status: "complete", detail });
  };

  let text = analyzeText(claim);
  await runStage("text", "Extracting entities, dates, and concept weights", () => {
    text = analyzeText(claim);
  });

  let imageAnalysis = await analyzeImage(null);
  let thumbnail: string | null = null;
  await runStage(
    "image",
    image ? "Computing colour, structure, and visual concepts" : "No image attached",
    async () => {
      imageAnalysis = await analyzeImage(image);
      if (image) thumbnail = await makeThumbnail(image);
    },
  );

  let consistency = compareTextAndImage(text, imageAnalysis);
  await runStage("consistency", "Comparing claim concepts with visual concepts", () => {
    consistency = compareTextAndImage(text, imageAnalysis);
  });

  let evidenceBundle: EvidenceBundle = {
    items: [],
    liveAttempted: false,
    liveSucceeded: false,
    mode: "local_fallback",
    queries: [],
  };
  await runStage("evidence", "Querying live sources when configured, plus local corpus", async () => {
    evidenceBundle = await retrieveEvidence(text);
  });

  let classification = classifyVerification({
    text,
    image: imageAnalysis,
    consistency,
    evidence: evidenceBundle.items,
    evidenceMode: evidenceBundle.mode,
    liveSucceeded: evidenceBundle.liveSucceeded,
  });
  await runStage("evidence_analysis", "Reading passages and aggregating stance", () => {
    classification = classifyVerification({
      text,
      image: imageAnalysis,
      consistency,
      evidence: evidenceBundle.items,
      evidenceMode: evidenceBundle.mode,
      liveSucceeded: evidenceBundle.liveSucceeded,
    });
  });

  await runStage("final", "Producing a bounded verdict", async () => {
    classification = await maybeRefineWithModel({ classification, claim });
  });

  const [row] = await db
    .insert(verifications)
    .values({
      claim: text.normalizedClaim,
      thumbnail,
      verdict: classification.verdict,
      confidence: classification.confidence,
      textImageConsistency: consistency?.score ?? null,
      evidenceSupport: classification.aggregation.supportScore,
      evidenceContradiction: classification.aggregation.contradictionScore,
      evidenceMode: evidenceBundle.mode,
      liveRetrievalSucceeded: evidenceBundle.liveSucceeded,
      textAnalysis: text,
      imageAnalysis,
      consistency,
      evidence: evidenceBundle.items,
      reasoning: classification.reasoning,
      summary: classification.summary,
    })
    .returning();

  return serializeVerification(row);
}

export function serializeVerification(row: typeof verifications.$inferSelect): VerificationRecord {
  return {
    id: row.id,
    claim: row.claim,
    thumbnail: row.thumbnail,
    verdict: row.verdict as VerificationRecord["verdict"],
    confidence: row.confidence,
    textImageConsistency: row.textImageConsistency,
    evidenceSupport: row.evidenceSupport,
    evidenceContradiction: row.evidenceContradiction,
    evidenceMode: row.evidenceMode as VerificationRecord["evidenceMode"],
    liveRetrievalSucceeded: row.liveRetrievalSucceeded,
    textAnalysis: row.textAnalysis as VerificationRecord["textAnalysis"],
    imageAnalysis: row.imageAnalysis as VerificationRecord["imageAnalysis"],
    consistency: (row.consistency as VerificationRecord["consistency"]) ?? null,
    evidence: row.evidence as VerificationRecord["evidence"],
    reasoning: row.reasoning as VerificationRecord["reasoning"],
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
  };
}
