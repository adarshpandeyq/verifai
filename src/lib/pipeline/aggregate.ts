import type {
  ConsistencyResult,
  EvidenceItem,
  ImageAnalysis,
  TextAnalysis,
  Verdict,
} from "@/lib/types";
import { clamp } from "@/lib/pipeline/math";
import { extractNumbers } from "@/lib/pipeline/stance";

export interface EvidenceAggregation {
  supportScore: number;
  contradictionScore: number;
  sourceQuality: number;
  sourceIndependence: number;
  evidenceDirectness: number;
  temporalMatch: number;
  entityMatch: number;
  supportingCount: number;
  contradictingCount: number;
  independentCount: number;
  evidenceStrength: number;
  debugSummary: string;
  verdict: Verdict;
  reasonCode: string;
}

function weight(item: EvidenceItem): number {
  const cred = item.credibility ?? (item.origin === "wikipedia" ? 0.84 : 0.55);
  const direct = item.directness ?? item.relevance;
  const entity = item.entityMatch ?? item.relevance;
  const originPenalty = item.origin === "local_corpus" ? 0.55 : 1;
  return (0.4 + 0.6 * cred) * (0.35 + 0.65 * direct) * (0.5 + 0.5 * entity) * originPenalty;
}

function uniqueKeys(items: EvidenceItem[]): string[] {
  const keys = items.map((i) => {
    if (i.url) {
      try {
        return new URL(i.url).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        return i.publisher.toLowerCase();
      }
    }
    return i.publisher.toLowerCase();
  });
  return [...new Set(keys.filter(Boolean))];
}

function mean(items: EvidenceItem[], pick: (i: EvidenceItem) => number): number {
  if (!items.length) return 0;
  return items.reduce((s, i) => s + pick(i), 0) / items.length;
}

function scaleMass(mass: number, count: number, independence: number): number {
  const grown = mass * (1 + 0.18 * Math.max(0, independence - 1)) * (1 + Math.min(0.25, (count - 1) * 0.08));
  return Math.round(clamp(100 * (1 - Math.exp(-grown / 1.15)), 0, 96));
}

export function aggregateEvidence(input: {
  claim: TextAnalysis;
  items: EvidenceItem[];
  liveSucceeded: boolean;
  image: ImageAnalysis;
  consistency: ConsistencyResult | null;
}): EvidenceAggregation {
  const { claim, items, liveSucceeded, image, consistency } = input;
  const supporting = items.filter((i) => i.stance === "support" || i.evidenceClass === "SUPPORTS");
  const contradicting = items.filter((i) => i.stance === "contradict" || i.evidenceClass === "CONTRADICTS");

  const liveSupport = supporting.filter((i) => i.origin !== "local_corpus");
  const liveContra = contradicting.filter((i) => i.origin !== "local_corpus");
  const supportPool = liveSucceeded || liveSupport.length ? liveSupport : supporting;
  const contraPool = liveSucceeded || liveContra.length ? [...liveContra, ...contradicting.filter((i) => i.origin === "local_corpus" && (i.entityMatch ?? 0) >= 0.45)] : contradicting;

  const supportMass = supportPool.reduce((s, i) => s + weight(i), 0);
  const contraMass = contraPool.reduce((s, i) => s + weight(i), 0);
  const independentKeys = uniqueKeys(supportPool);
  const independentCount = independentKeys.length;
  const supportScore = supportPool.length ? scaleMass(supportMass, supportPool.length, independentCount) : 0;
  const contradictionScore = contraPool.length
    ? scaleMass(contraMass, contraPool.length, uniqueKeys(contraPool).length)
    : 0;

  const sourceQuality = supportPool.length
    ? mean(supportPool, (i) => i.credibility ?? 0.5)
    : contraPool.length
      ? mean(contraPool, (i) => i.credibility ?? 0.5)
      : 0;
  const evidenceDirectness = supportPool.length
    ? mean(supportPool, (i) => i.directness ?? i.relevance)
    : 0;
  const temporalMatch = supportPool.length
    ? mean(supportPool, (i) => i.dateMatch ?? 0.7)
    : mean(items, (i) => i.dateMatch ?? 0.5);
  const entityMatch = supportPool.length
    ? mean(supportPool, (i) => i.entityMatch ?? i.relevance)
    : mean(items, (i) => i.entityMatch ?? 0);

  const sourceIndependence = clamp(independentCount / 3, 0, 1);
  const evidenceStrength = Math.round(
    clamp(
      supportScore * 0.55 +
        (1 - contradictionScore / 100) * 18 +
        sourceQuality * 16 +
        evidenceDirectness * 12 +
        independentCount * 4 -
        (contradictionScore > supportScore ? 12 : 0),
      0,
      96,
    ),
  );

  const primary = supportPool.filter(
    (i) => (i.credibility ?? 0) >= 0.78 && (i.directness ?? 0) >= 0.42 && (i.entityMatch ?? i.relevance) >= 0.4,
  );
  const solidSecondary = supportPool.filter(
    (i) => (i.directness ?? 0) >= 0.32 && (i.claimCoverage ?? i.relevance) >= 0.28,
  );
  const alignedSupport = supportPool.filter(
    (i) => (i.claimCoverage ?? i.relevance) >= 0.42 && (i.directness ?? 0) >= 0.35,
  );

  const strongSupport =
    primary.length >= 1 ||
    (independentCount >= 2 && solidSecondary.length >= 2) ||
    (independentCount >= 1 && supportPool.length >= 2 && supportScore >= 38 && evidenceDirectness >= 0.34) ||
    (supportScore >= 46 && contradictionScore < 22 && supportPool.length >= 1) ||
    (claim.isDefinitional && alignedSupport.length >= 1 && contradictionScore < 28);

  const onTopicContra = contraPool.filter(
    (i) => (i.entityMatch ?? 0) >= 0.5 || (i.claimCoverage ?? 0) >= 0.34,
  );
  const strongContra =
    (contraPool.some((i) => (i.credibility ?? 0) >= 0.78 && (i.directness ?? 0) >= 0.4) &&
      contradictionScore >= 28) ||
    (contradictionScore >= 44 && contradictionScore >= supportScore + 8) ||
    (contraPool.length >= 2 && contradictionScore >= 32 && supportScore < 30) ||
    (supportPool.length === 0 && onTopicContra.length >= 1);

  const newsLike = claim.isNewsLike && !claim.isDefinitional;
  const localOnlySupport = supportPool.length > 0 && supportPool.every((i) => i.origin === "local_corpus");
  const cannotCertifyNewsFromCorpus = localOnlySupport && newsLike && claim.dates.some((d) => d.kind === "relative");

  const absoluteUnmatched =
    claim.absoluteLanguage.length > 0 &&
    supportPool.length > 0 &&
    !supportPool.some((i) =>
      claim.absoluteLanguage.some((w) => i.passage.toLowerCase().includes(w.toLowerCase())),
    ) &&
    evidenceDirectness < 0.7 &&
    claim.sensationalism >= 0.25;

  const numericalMatch = supportPool.length
    ? mean(supportPool, (i) => i.numericalMatch ?? 0.7)
    : 1;
  const numberFail = extractNumbers(claim.normalizedClaim).length > 0 && numericalMatch < 0.34 && supportPool.length > 0;

  const yearInClaim = (claim.normalizedClaim.match(/\b(?:19|20)\d{2}\b/g) ?? []).length > 0;
  const temporalFail =
    supportPool.length > 0 &&
    temporalMatch < 0.34 &&
    (claim.dates.length > 0 || yearInClaim || numberFail);

  const locationFail =
    claim.locations.length > 0 &&
    supportPool.length > 0 &&
    mean(supportPool, (i) => i.locationMatch ?? 0) < 0.28 &&
    entityMatch < 0.45;

  const imageContextWrong =
    Boolean(consistency?.exifConflict) ||
    (image.hasImage && (consistency?.score ?? 100) < 32 && (claim.specificity > 0.3 || claim.isNewsLike));

  let verdict: Verdict = "UNVERIFIED";
  let reasonCode = "insufficient";

  const contextMismatch = temporalFail || locationFail || absoluteUnmatched || imageContextWrong;
  const relatedEvent =
    strongSupport ||
    (supportPool.length >= 1 && entityMatch >= 0.4 && (evidenceDirectness >= 0.3 || supportScore >= 28));

  if (relatedEvent && contextMismatch && !(strongContra && !temporalFail && !locationFail && contradictionScore > supportScore + 18)) {
    verdict = "MISLEADING";
    reasonCode = temporalFail
      ? "wrong_or_weak_time"
      : locationFail
        ? "wrong_or_weak_location"
        : absoluteUnmatched
          ? "exaggerated_context"
          : "image_context_mismatch";
  } else if (strongContra && contradictionScore >= supportScore - 4) {
    verdict = "FALSE";
    reasonCode = "reliable_contradiction";
  } else if (
    strongSupport &&
    !cannotCertifyNewsFromCorpus &&
    contradictionScore < 34 &&
    contradictionScore <= supportScore * 0.72
  ) {
    if (imageContextWrong && !liveSupport.length && !newsLike) {
      verdict = "TRUE";
      reasonCode = "supported_stable_fact";
    } else {
      verdict = "TRUE";
      reasonCode = primary.length ? "authoritative_confirmation" : "independent_corroboration";
    }
  } else if (imageContextWrong && (strongSupport || supportScore >= 28)) {
    verdict = "MISLEADING";
    reasonCode = "image_context_mismatch";
  } else if (strongSupport && cannotCertifyNewsFromCorpus) {
    verdict = "UNVERIFIED";
    reasonCode = "no_contemporaneous_source";
  } else {
    verdict = "UNVERIFIED";
    reasonCode = supportPool.length + contraPool.length === 0 ? "no_usable_evidence" : "ambiguous_or_thin";
  }

  const debugSummary = [
    `Supporting sources: ${supportPool.length}`,
    `Contradicting sources: ${contraPool.length}`,
    `Independent sources: ${independentCount}`,
    `Evidence strength: ${evidenceStrength}%`,
    `Final verdict: ${verdict}`,
  ].join(" · ");

  return {
    supportScore,
    contradictionScore,
    sourceQuality: Math.round(sourceQuality * 100),
    sourceIndependence: Math.round(sourceIndependence * 100),
    evidenceDirectness: Math.round(evidenceDirectness * 100),
    temporalMatch: Math.round(temporalMatch * 100),
    entityMatch: Math.round(entityMatch * 100),
    supportingCount: supportPool.length,
    contradictingCount: contraPool.length,
    independentCount,
    evidenceStrength,
    debugSummary,
    verdict,
    reasonCode,
  };
}
