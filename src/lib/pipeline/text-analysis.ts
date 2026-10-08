import type { ConceptVector, DateMention, Entity, TextAnalysis } from "@/lib/types";
import {
  ABSOLUTE_TERMS,
  EVENT_TERMS,
  LOCATIONS,
  ORGANIZATIONS,
  RELATIVE_DATES,
} from "@/lib/pipeline/gazetteer";
import {
  CONCEPT_KEYS,
  CONCEPT_LEXICON,
  emptyConcepts,
  normalizeConcepts,
} from "@/lib/pipeline/concepts";
import {
  extractAbsoluteDates,
  extractMainClaim,
  findPhrases,
  isoDate,
  normalizeText,
  tokenize,
} from "@/lib/pipeline/nlp";
import { clamp } from "@/lib/pipeline/math";

function resolveRelative(raw: string, now: Date): string | undefined {
  const key = raw.toLowerCase();
  const d = new Date(now);
  if (key === "yesterday" || key === "last night") d.setDate(d.getDate() - 1);
  if (key === "tomorrow") d.setDate(d.getDate() + 1);
  return isoDate(d);
}

export function analyzeText(claim: string, now = new Date()): TextAnalysis {
  const normalizedClaim = normalizeText(claim);
  const lower = normalizedClaim.toLowerCase();
  const tokens = tokenize(normalizedClaim);
  const locations = findPhrases(lower, LOCATIONS);
  const organizations = findPhrases(lower, ORGANIZATIONS);
  const events = findPhrases(lower, EVENT_TERMS);
  const relativeHits = findPhrases(lower, RELATIVE_DATES);
  const absoluteHits = extractAbsoluteDates(normalizedClaim);
  const absoluteLanguage = findPhrases(lower, ABSOLUTE_TERMS);

  const dates: DateMention[] = [
    ...relativeHits.map((raw) => ({
      raw,
      kind: "relative" as const,
      resolved: resolveRelative(raw, now),
    })),
    ...absoluteHits.map((raw) => ({ raw, kind: "absolute" as const })),
  ];

  const entities: Entity[] = [];
  for (const loc of locations) entities.push({ text: titleCase(loc), type: "location" });
  for (const org of organizations) entities.push({ text: org.toUpperCase() === org ? org : titleCase(org), type: "org" });
  for (const ev of events) entities.push({ text: ev, type: "event" });

  const proper = normalizedClaim.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) || [];
  for (const p of proper) {
    const lp = p.toLowerCase();
    if (["The", "A", "An", "This", "That"].includes(p)) continue;
    if (locations.includes(lp) || organizations.includes(lp)) continue;
    if (!entities.some((e) => e.text.toLowerCase() === lp)) {
      entities.push({ text: p, type: "person" });
    }
  }

  const concepts = emptyConcepts();
  for (const key of CONCEPT_KEYS) {
    let score = 0;
    for (const word of CONCEPT_LEXICON[key]) {
      if (lower.includes(word)) score += word.includes(" ") ? 0.55 : 0.35;
    }
    concepts[key] = score;
  }
  const conceptVec: ConceptVector = normalizeConcepts(concepts);

  const airport = /\bairport\b/i.test(normalizedClaim);
  if (airport) {
    conceptVec.urban = Math.max(conceptVec.urban, 0.7);
    conceptVec.vehicle = Math.max(conceptVec.vehicle, 0.35);
  }

  const specificity = clamp(
    (locations.length > 0 ? 0.28 : 0) +
      (dates.length > 0 ? 0.22 : 0) +
      (organizations.length > 0 ? 0.12 : 0) +
      (events.length > 0 ? 0.18 : 0) +
      Math.min(0.2, tokens.length / 40),
    0,
    1,
  );

  const sensationalism = clamp(
    absoluteLanguage.length * 0.22 +
      (/(breaking|share|must see|you won't believe|exposed)/i.test(lower) ? 0.3 : 0) +
      (/(completely shut|totally destroyed|all dead|cure for all)/i.test(lower) ? 0.28 : 0),
    0,
    1,
  );

  const isDefinitional =
    /\b(is defined as|means that|boils at|freezes at|chemical formula|speed of light|capital of)\b/i.test(
      lower,
    ) ||
    /\bboils at\b/i.test(lower) ||
    /\bat standard atmospheric pressure\b/i.test(lower);

  const isNewsLike =
    !isDefinitional &&
    (Boolean(locations.length && events.length) ||
      /\b(today|yesterday|breaking|officials|reported|killed|closed|announced)\b/i.test(lower));

  return {
    normalizedClaim,
    mainClaim: extractMainClaim(normalizedClaim),
    tokenCount: tokens.length,
    entities: dedupeEntities(entities).slice(0, 12),
    locations: locations.map(titleCase),
    events,
    organizations: organizations.map(titleCase),
    dates,
    timeReferences: dates.map((d) => d.raw),
    absoluteLanguage,
    causalLanguage: /\b(because|due to|caused by|after|following)\b/i.test(lower),
    isNewsLike,
    isDefinitional,
    specificity,
    sensationalism,
    concepts: conceptVec,
  };
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function dedupeEntities(entities: Entity[]): Entity[] {
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const e of entities) {
    const k = `${e.type}:${e.text.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
