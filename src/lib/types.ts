export type Verdict = "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIED";

export type PipelineStageId =
  | "text"
  | "image"
  | "consistency"
  | "evidence"
  | "evidence_analysis"
  | "final";

export type StageStatus = "idle" | "running" | "complete" | "error";

export type EvidenceOrigin = "web_search" | "wikipedia" | "local_corpus";
export type EvidenceStance = "support" | "contradict" | "neutral";

export type EntityType = "location" | "person" | "org" | "event" | "other";

export interface Entity {
  text: string;
  type: EntityType;
}

export interface DateMention {
  raw: string;
  kind: "absolute" | "relative";
  resolved?: string;
}

export type ConceptKey =
  | "water"
  | "fire"
  | "vegetation"
  | "urban"
  | "sky"
  | "night"
  | "indoor"
  | "snow"
  | "document"
  | "portrait"
  | "vehicle"
  | "crowd"
  | "disaster"
  | "weather"
  | "animal"
  | "food";

export type ConceptVector = Record<ConceptKey, number>;

export interface TextAnalysis {
  normalizedClaim: string;
  mainClaim: string;
  tokenCount: number;
  entities: Entity[];
  locations: string[];
  events: string[];
  organizations: string[];
  dates: DateMention[];
  timeReferences: string[];
  absoluteLanguage: string[];
  causalLanguage: boolean;
  isNewsLike: boolean;
  isDefinitional: boolean;
  specificity: number;
  sensationalism: number;
  concepts: ConceptVector;
}

export interface ImageAnalysis {
  hasImage: boolean;
  width: number;
  height: number;
  format: string | null;
  averageColor: { r: number; g: number; b: number };
  brightness: number;
  saturation: number;
  contrast: number;
  edgeEnergy: number;
  visualConcepts: ConceptVector;
  conceptLabels: string[];
  exifDate: string | null;
  likelyScreenshot: boolean;
  likelyDocument: boolean;
  notes: string[];
}

export interface ConsistencyOverlap {
  concept: ConceptKey;
  text: number;
  image: number;
}

export interface ConsistencyResult {
  score: number;
  cosine: number;
  overlappingConcepts: ConsistencyOverlap[];
  mismatches: string[];
  caveats: string[];
  exifConflict: boolean;
}

export type EvidenceClass = "SUPPORTS" | "CONTRADICTS" | "NEUTRAL" | "INSUFFICIENT";

export interface EvidenceItem {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  date: string | null;
  passage: string;
  stance: EvidenceStance;
  relevance: number;
  origin: EvidenceOrigin;
  evidenceClass?: EvidenceClass;
  credibility?: number;
  directness?: number;
  entityMatch?: number;
  eventMatch?: number;
  dateMatch?: number;
  locationMatch?: number;
  numericalMatch?: number;
  claimCoverage?: number;
}

export interface ReasoningBullet {
  kind: "support" | "against" | "caution";
  text: string;
}

export interface VerificationRecord {
  id: number;
  claim: string;
  thumbnail: string | null;
  verdict: Verdict;
  confidence: number;
  textImageConsistency: number | null;
  evidenceSupport: number;
  evidenceContradiction: number;
  evidenceMode: "live" | "mixed" | "local_fallback";
  liveRetrievalSucceeded: boolean;
  textAnalysis: TextAnalysis;
  imageAnalysis: ImageAnalysis;
  consistency: ConsistencyResult | null;
  evidence: EvidenceItem[];
  reasoning: ReasoningBullet[];
  summary: string;
  createdAt: string;
}

export type VerifyEvent =
  | { type: "stage"; id: PipelineStageId; status: "running" | "complete"; detail?: string }
  | { type: "result"; verification: VerificationRecord }
  | { type: "error"; message: string };

export interface PublicConfig {
  searchConfigured: boolean;
  modelConfigured: boolean;
  wikipediaEnabled: boolean;
  searchProvider: string | null;
}
