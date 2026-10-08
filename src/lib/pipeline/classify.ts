import type {
  ConsistencyResult,
  EvidenceItem,
  ImageAnalysis,
  ReasoningBullet,
  TextAnalysis,
  Verdict,
} from "@/lib/types";
import { clamp } from "@/lib/pipeline/math";
import { getPublicConfig } from "@/lib/config";
import { aggregateEvidence, type EvidenceAggregation } from "@/lib/pipeline/aggregate";

export interface Classification {
  verdict: Verdict;
  confidence: number;
  reasoning: ReasoningBullet[];
  summary: string;
  aggregation: EvidenceAggregation;
}

export function classifyVerification(input: {
  text: TextAnalysis;
  image: ImageAnalysis;
  consistency: ConsistencyResult | null;
  evidence: EvidenceItem[];
  evidenceMode: "live" | "mixed" | "local_fallback";
  liveSucceeded: boolean;
  support?: number;
  contradict?: number;
}): Classification {
  const { text, image, consistency, evidence, evidenceMode, liveSucceeded } = input;
  const aggregation = aggregateEvidence({
    claim: text,
    items: evidence,
    liveSucceeded,
    image,
    consistency,
  });

  const reasoning: ReasoningBullet[] = [];
  const cons = consistency?.score ?? null;

  reasoning.push({
    kind: "caution",
    text: "Text–image similarity is not a truth signal. An old or miscaptioned picture can still match a claim closely.",
  });

  if (image.hasImage && cons !== null) {
    reasoning.push({
      kind: cons >= 55 ? "support" : "against",
      text:
        cons >= 55
          ? `The image’s visual concepts overlap the claim (consistency ${cons}%). That only means the picture looks related.`
          : `The image does not strongly match the claim’s visual concepts (consistency ${cons}%).`,
    });
  } else {
    reasoning.push({
      kind: "caution",
      text: "No image was supplied, so the pipeline scored language and evidence only.",
    });
  }

  for (const mismatch of consistency?.mismatches.slice(0, 2) ?? []) {
    reasoning.push({ kind: "against", text: mismatch });
  }

  const supporting = evidence.filter((e) => e.stance === "support");
  const contradicting = evidence.filter((e) => e.stance === "contradict");

  if (supporting.length) {
    reasoning.push({
      kind: "support",
      text: `Supporting sources: ${supporting
        .slice(0, 3)
        .map((s) => s.title)
        .join("; ")}.`,
    });
  }
  if (contradicting.length) {
    reasoning.push({
      kind: "against",
      text: `Contradicting sources: ${contradicting
        .slice(0, 3)
        .map((s) => s.title)
        .join("; ")}.`,
    });
  }

  if (evidenceMode === "local_fallback") {
    reasoning.push({
      kind: "caution",
      text: "Live web retrieval did not return sources in this environment. Local demonstration corpus entries are labelled as such and are not live news.",
    });
  } else if (liveSucceeded) {
    reasoning.push({
      kind: "support",
      text: "Live sources were retrieved and compared against the claim text — not merely counted as links.",
    });
  }

  const verdict = aggregation.verdict;
  let base =
    verdict === "TRUE"
      ? 62 + aggregation.evidenceStrength * 0.28
      : verdict === "FALSE"
        ? 62 + aggregation.contradictionScore * 0.22
        : verdict === "MISLEADING"
          ? 58 + Math.min(16, aggregation.supportScore * 0.12)
          : 28 + text.specificity * 10;

  if (verdict === "TRUE") {
    reasoning.push({
      kind: "support",
      text:
        aggregation.reasonCode === "authoritative_confirmation"
          ? "At least one high-credibility source directly confirms the claim, with no strong contradiction."
          : "Independent sources corroborate the claim when read together. A single perfect article is not required.",
    });
  } else if (verdict === "FALSE") {
    reasoning.push({
      kind: "against",
      text: "Reliable evidence directly contradicts the claim.",
    });
  } else if (verdict === "MISLEADING") {
    reasoning.push({
      kind: "against",
      text:
        aggregation.reasonCode === "image_context_mismatch"
          ? "The underlying information may be real, but the image or framing does not match the claimed time, place, or context."
          : "The evidence indicates a related fact, but the claim’s date, location, person, or intensity is off.",
    });
  } else {
    reasoning.push({
      kind: "caution",
      text: "Available passages are insufficient, mixed, or too indirect to certify the claim.",
    });
  }

  reasoning.push({
    kind: "caution",
    text: aggregation.debugSummary,
  });

  if (evidenceMode === "local_fallback" && verdict === "TRUE") base = Math.min(base, 80);
  if (verdict === "UNVERIFIED") base = Math.min(base, 56);

  const confidence = Math.round(clamp(base, 8, 94));
  const summary = buildSummary(verdict, text, cons, evidenceMode, liveSucceeded, aggregation);

  return {
    verdict,
    confidence,
    reasoning: reasoning.slice(0, 14),
    summary,
    aggregation,
  };
}

function buildSummary(
  verdict: Verdict,
  text: TextAnalysis,
  cons: number | null,
  mode: string,
  live: boolean,
  agg: EvidenceAggregation,
): string {
  const claim = text.mainClaim;
  const debug = agg.debugSummary;
  if (verdict === "TRUE") {
    return `The retrieved passages confirm “${claim}”. ${debug}`;
  }
  if (verdict === "FALSE") {
    return `Reliable evidence contradicts “${claim}”. ${debug}`;
  }
  if (verdict === "MISLEADING") {
    return `“${claim}” is partly related to real information but the context is wrong${cons !== null ? ` (visual consistency ${cons}%)` : ""}. ${debug}`;
  }
  return `Evidence is insufficient or unresolved for “${claim}”. ${
    live ? "Sources were retrieved but did not settle the proposition." : "Live retrieval was unavailable."
  } Mode: ${mode}. ${debug}`;
}

export async function maybeRefineWithModel(input: {
  classification: Classification;
  claim: string;
}): Promise<Classification> {
  const config = getPublicConfig();
  if (!config.openaiKey) return input.classification;
  if (input.classification.aggregation.evidenceStrength >= 40 && input.classification.verdict !== "UNVERIFIED") {
    return input.classification;
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You assist a misinformation classifier. Do not invent sources or URLs. Do not downgrade TRUE or FALSE when the aggregation already shows confirming or contradicting sources. Prefer UNVERIFIED only when evidence is genuinely insufficient. Reply with JSON {verdict, confidence, summary}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              claim: input.claim,
              current: {
                verdict: input.classification.verdict,
                confidence: input.classification.confidence,
                summary: input.classification.summary,
                aggregation: input.classification.aggregation,
              },
            }).slice(0, 6000),
          },
        ],
      }),
    });
    if (!res.ok) return input.classification;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return input.classification;
    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict?: Verdict;
      confidence?: number;
      summary?: string;
    };
    const allowed: Verdict[] = ["TRUE", "FALSE", "MISLEADING", "UNVERIFIED"];
    if (!parsed.verdict || !allowed.includes(parsed.verdict)) return input.classification;
    return {
      ...input.classification,
      verdict: parsed.verdict,
      confidence: Math.round(clamp(Number(parsed.confidence) || input.classification.confidence, 8, 94)),
      summary: parsed.summary || input.classification.summary,
    };
  } catch {
    return input.classification;
  }
}
