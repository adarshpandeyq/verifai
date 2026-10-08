import { analyzeText } from "../src/lib/pipeline/text-analysis";
import { retrieveEvidence } from "../src/lib/pipeline/evidence";
import { classifyVerification } from "../src/lib/pipeline/classify";
import { emptyConcepts } from "../src/lib/pipeline/concepts";
import type { ImageAnalysis } from "../src/lib/types";

const image: ImageAnalysis = {
  hasImage: false,
  width: 0,
  height: 0,
  format: null,
  averageColor: { r: 0, g: 0, b: 0 },
  brightness: 0,
  saturation: 0,
  contrast: 0,
  edgeEnergy: 0,
  visualConcepts: emptyConcepts(),
  conceptLabels: [],
  exifDate: null,
  likelyScreenshot: false,
  likelyDocument: false,
  notes: [],
};

async function check(claim: string) {
  const text = analyzeText(claim);
  const bundle = await retrieveEvidence(text);
  const result = classifyVerification({
    text,
    image,
    consistency: null,
    evidence: bundle.items,
    evidenceMode: bundle.mode,
    liveSucceeded: bundle.liveSucceeded,
  });
  console.log("\nCLAIM:", claim);
  console.log("mode:", bundle.mode, "live:", bundle.liveSucceeded, "queries:", bundle.queries);
  console.log(
    "items:",
    bundle.items.map((i) => `${i.evidenceClass}/${i.origin}:${i.title}`).join(" | ") || "(none)",
  );
  console.log(result.aggregation.debugSummary);
  console.log("verdict:", result.verdict, result.aggregation.reasonCode);
  return result.verdict;
}

async function main() {
  const claims = [
    "Paris is the capital of France.",
    "Tokyo is the capital of Japan.",
    "The Eiffel Tower was dismantled last night.",
    "Water boils at 100°C at standard atmospheric pressure.",
    "The Earth is the third planet from the Sun.",
  ];
  for (const claim of claims) {
    try {
      await check(claim);
    } catch (err) {
      console.log("ERROR for", claim, err);
    }
  }
}

main();
