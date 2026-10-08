import type { ConceptKey, ConceptVector } from "@/lib/types";

export const CONCEPT_KEYS: ConceptKey[] = [
  "water",
  "fire",
  "vegetation",
  "urban",
  "sky",
  "night",
  "indoor",
  "snow",
  "document",
  "portrait",
  "vehicle",
  "crowd",
  "disaster",
  "weather",
  "animal",
  "food",
];

export const CONCEPT_LEXICON: Record<ConceptKey, string[]> = {
  water: [
    "flood",
    "flooding",
    "flooded",
    "water",
    "rain",
    "rainfall",
    "river",
    "lake",
    "ocean",
    "sea",
    "tsunami",
    "monsoon",
    "deluge",
    "inundat",
    "wet",
    "dam",
    "wave",
    "storm surge",
  ],
  fire: [
    "fire",
    "blaze",
    "burn",
    "wildfire",
    "smoke",
    "flame",
    "flames",
    "explosion",
    "arson",
    "inferno",
  ],
  vegetation: [
    "forest",
    "tree",
    "trees",
    "jungle",
    "park",
    "garden",
    "grass",
    "farm",
    "crop",
    "field",
    "plant",
  ],
  urban: [
    "city",
    "airport",
    "building",
    "skyline",
    "street",
    "road",
    "downtown",
    "bridge",
    "tower",
    "station",
    "metro",
    "highway",
    "concrete",
    "terminal",
  ],
  sky: ["sky", "cloud", "clouds", "aerial", "horizon", "plane", "aircraft"],
  night: ["night", "midnight", "tonight", "dark", "evening", "nocturnal"],
  indoor: ["indoor", "inside", "office", "room", "hall", "hospital", "classroom"],
  snow: ["snow", "blizzard", "ice", "frozen", "hail", "winter storm"],
  document: [
    "chart",
    "graph",
    "screenshot",
    "document",
    "report",
    "statement",
    "tweet",
    "post",
    "headline",
    "article",
  ],
  portrait: [
    "person",
    "people",
    "man",
    "woman",
    "president",
    "minister",
    "celebrity",
    "actor",
    "face",
    "portrait",
  ],
  vehicle: [
    "car",
    "bus",
    "train",
    "plane",
    "aircraft",
    "ship",
    "truck",
    "vehicle",
    "flight",
    "crash",
  ],
  crowd: ["crowd", "protest", "rally", "march", "audience", "fans", "stadium"],
  disaster: [
    "disaster",
    "earthquake",
    "collapse",
    "destroyed",
    "wreckage",
    "rubble",
    "catastrophe",
    "emergency",
    "evacuat",
    "closed",
    "shutdown",
    "shut",
  ],
  weather: [
    "weather",
    "storm",
    "cyclone",
    "hurricane",
    "typhoon",
    "tornado",
    "heatwave",
    "temperature",
    "climate",
  ],
  animal: ["animal", "dog", "cat", "bird", "wildlife", "lion", "elephant"],
  food: ["food", "meal", "restaurant", "coffee", "tea", "fruit", "bread"],
};

export function emptyConcepts(): ConceptVector {
  return {
    water: 0,
    fire: 0,
    vegetation: 0,
    urban: 0,
    sky: 0,
    night: 0,
    indoor: 0,
    snow: 0,
    document: 0,
    portrait: 0,
    vehicle: 0,
    crowd: 0,
    disaster: 0,
    weather: 0,
    animal: 0,
    food: 0,
  };
}

export function conceptArray(vec: ConceptVector): number[] {
  return CONCEPT_KEYS.map((k) => vec[k]);
}

export function topConcepts(vec: ConceptVector, min = 0.18): string[] {
  return CONCEPT_KEYS.filter((k) => vec[k] >= min).sort((a, b) => vec[b] - vec[a]);
}

export function normalizeConcepts(vec: ConceptVector): ConceptVector {
  const max = Math.max(...CONCEPT_KEYS.map((k) => vec[k]), 1e-6);
  const next = emptyConcepts();
  for (const k of CONCEPT_KEYS) {
    next[k] = Math.min(1, vec[k] / (max > 1 ? max : 1));
  }
  return next;
}
