import type {
  EvidenceClass,
  EvidenceItem,
  EvidenceOrigin,
  EvidenceStance,
  TextAnalysis,
} from "@/lib/types";
import { clamp } from "@/lib/pipeline/math";
import { sentences, tokenize } from "@/lib/pipeline/nlp";

export interface PassageAssessment {
  evidenceClass: EvidenceClass;
  stance: EvidenceStance;
  directness: number;
  entityMatch: number;
  eventMatch: number;
  dateMatch: number;
  locationMatch: number;
  numericalMatch: number;
  credibility: number;
  claimCoverage: number;
  independenceKey: string;
  relevantExcerpt: string;
}

const PREDICATES = new Set([
  "won",
  "win",
  "wins",
  "winner",
  "winning",
  "defeated",
  "beat",
  "beaten",
  "elected",
  "lost",
  "lose",
  "loser",
  "died",
  "dead",
  "killed",
  "closed",
  "close",
  "closure",
  "shut",
  "shutdown",
  "opened",
  "announced",
  "declared",
  "founded",
  "born",
  "invented",
  "launched",
  "crashed",
  "signed",
  "passed",
  "resigned",
  "arrested",
  "capital",
  "boils",
  "boil",
  "equals",
  "orbit",
  "discovered",
  "scored",
  "champion",
  "champions",
  "title",
  "president",
  "acquired",
  "merger",
  "ipo",
  "bankrupt",
  "released",
  "published",
  "awarded",
  "dismantled",
  "destroyed",
  "demolished",
  "collapsed",
  "sank",
  "cure",
  "cures",
  "caused",
  "confirmed",
  "projected",
  "re-elected",
  "reelected",
]);

const ANTONYM_GROUPS: string[][] = [
  ["won", "win", "wins", "winner", "winning", "elected", "victor"],
  ["lost", "lose", "loser", "losing", "defeated"],
  ["dead", "died", "killed", "death", "deceased"],
  ["alive", "survived", "living"],
  ["closed", "close", "closure", "shut", "shutdown"],
  ["open", "opened", "reopened", "operating"],
  ["dismantled", "destroyed", "demolished", "collapsed", "sank"],
  ["stands", "standing", "remains", "intact", "operating"],
  ["true", "confirmed", "verify"],
  ["false", "hoax", "debunked", "untrue"],
  ["increased", "rose", "gain"],
  ["decreased", "fell", "drop"],
];

const NEG_TOKENS = new Set([
  "not",
  "no",
  "never",
  "without",
  "false",
  "hoax",
  "incorrect",
  "untrue",
  "debunked",
  "unfounded",
  "denied",
  "denies",
  "unlike",
  "nor",
  "cannot",
  "can't",
  "didnt",
  "didn't",
  "didn’t",
  "isnt",
  "isn't",
  "wasnt",
  "wasn't",
  "wont",
  "won't",
  "neither",
]);

const EXISTENCE_PHRASES = [
  "is a",
  "is an",
  "are a",
  "remains",
  "still stands",
  "stands in",
  "located in",
  "located on",
  "operates",
  "is the capital",
  "serves as",
];

const DESTRUCTION_CLAIM = /\b(dismantled|destroyed|demolished|collapsed|sank|killed|died|dead|wiped out)\b/i;

const HIGH_CREDIBILITY = [
  /wikipedia\.org/i,
  /reuters\.com/i,
  /apnews\.com/i,
  /associatedpress\.com/i,
  /\.ap\.org/i,
  /bbc\.(com|co\.uk)/i,
  /afp\.com/i,
  /npr\.org/i,
  /nytimes\.com/i,
  /washingtonpost\.com/i,
  /theguardian\.com/i,
  /wsj\.com/i,
  /ft\.com/i,
  /economist\.com/i,
  /aljazeera\.com/i,
  /dw\.com/i,
  /nature\.com/i,
  /sciencemag\.org/i,
  /who\.int/i,
  /un\.org/i,
  /unesco\.org/i,
  /nasa\.gov/i,
  /nih\.gov/i,
  /cdc\.gov/i,
  /europa\.eu/i,
  /\.gov(\.|$)/i,
  /\.gov\.[a-z]{2,}/i,
  /britannica\.com/i,
  /election/i,
  /electoral/i,
];

const MID_CREDIBILITY = [
  /espn\.com/i,
  /espncricinfo\.com/i,
  /cricbuzz\.com/i,
  /forbes\.com/i,
  /bloomberg\.com/i,
  /cnn\.com/i,
  /nbcnews\.com/i,
  /abcnews\.go\.com/i,
  /cbsnews\.com/i,
  /time\.com/i,
  /\.edu(\.|$)/i,
  /wikidata\.org/i,
];

export function rawWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/n['’]t\b/g, " not")
    .replace(/[^a-z0-9\s%.°-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function sourceCredibility(item: Pick<EvidenceItem, "publisher" | "url" | "origin">): number {
  const blob = `${item.publisher} ${item.url ?? ""}`.toLowerCase();
  if (HIGH_CREDIBILITY.some((re) => re.test(blob))) return item.origin === "wikipedia" ? 0.84 : 0.92;
  if (item.origin === "wikipedia") return 0.84;
  if (MID_CREDIBILITY.some((re) => re.test(blob))) return 0.74;
  if (item.origin === "web_search") return 0.58;
  if (item.origin === "local_corpus") return 0.44;
  return 0.5;
}

export function independenceKey(item: Pick<EvidenceItem, "publisher" | "url">): string {
  if (item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return item.publisher.trim().toLowerCase() || "unknown";
}

function coverage(claimTokens: string[], docTokens: string[]): number {
  if (!claimTokens.length) return 0;
  const set = new Set(docTokens);
  let hit = 0;
  for (const t of claimTokens) {
    if (set.has(t)) hit += 1;
  }
  return hit / claimTokens.length;
}

function entityHits(entities: string[], doc: string): number {
  if (!entities.length) return 0;
  const lower = doc.toLowerCase();
  let hit = 0;
  for (const ent of entities) {
    const e = ent.toLowerCase().trim();
    if (e.length < 2) continue;
    if (lower.includes(e)) hit += 1;
    else {
      const parts = e.split(/\s+/).filter((p) => p.length > 2);
      if (parts.length && parts.every((p) => lower.includes(p))) hit += 0.7;
    }
  }
  return hit / entities.length;
}

function antonymClash(claimWords: string[], docWords: string[]): boolean {
  const claimSet = new Set(claimWords);
  const docSet = new Set(docWords);
  for (const group of ANTONYM_GROUPS) {
    const claimHas = group.some((g) => claimSet.has(g));
    if (!claimHas) continue;
    const others = ANTONYM_GROUPS.filter((g) => g !== group);
    for (const other of others) {
      const related =
        (group.includes("won") && other.includes("lost")) ||
        (group.includes("lost") && other.includes("won")) ||
        (group.includes("dead") && other.includes("alive")) ||
        (group.includes("alive") && other.includes("dead")) ||
        (group.includes("closed") && other.includes("open")) ||
        (group.includes("open") && other.includes("closed")) ||
        (group.includes("dismantled") && other.includes("stands")) ||
        (group.includes("stands") && other.includes("dismantled")) ||
        (group.includes("true") && other.includes("false")) ||
        (group.includes("false") && other.includes("true")) ||
        (group.includes("increased") && other.includes("decreased")) ||
        (group.includes("decreased") && other.includes("increased"));
      if (!related) continue;
      if (other.some((g) => docSet.has(g)) && !group.some((g) => docSet.has(g))) return true;
    }
  }
  return false;
}

function localNegation(words: string[], predicates: string[]): boolean {
  if (!predicates.length) return false;
  const wanted = new Set(predicates);
  for (let i = 0; i < words.length; i++) {
    if (!wanted.has(words[i])) continue;
    const window = words.slice(Math.max(0, i - 5), i);
    if (window.some((w) => NEG_TOKENS.has(w))) return true;
  }
  return false;
}

function tokenNegated(words: string[], token: string): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== token) continue;
    const window = words.slice(Math.max(0, i - 6), Math.min(words.length, i + 7));
    if (window.some((w) => NEG_TOKENS.has(w) || w === "myth" || w === "debunked" || w === "hoax")) return true;
  }
  return false;
}

function bestExcerpt(full: string, claimTokens: string[]): string {
  const parts = sentences(full);
  if (!parts.length) return full.replace(/\s+/g, " ").trim().slice(0, 420);
  const ranked = parts
    .map((p) => ({ p, s: coverage(claimTokens, tokenize(p)) }))
    .sort((a, b) => b.s - a.s);
  const top = ranked.slice(0, 2).map((r) => r.p);
  return top.join(" ").slice(0, 420);
}

function dateMatchScore(claim: TextAnalysis, doc: string, sourceDate: string | null): number {
  if (!claim.dates.length) return 0.7;
  const lower = doc.toLowerCase();
  let score = 0.35;
  for (const d of claim.dates) {
    if (d.kind === "absolute") {
      const year = d.raw.match(/(?:19|20)\d{2}/)?.[0];
      if (d.raw.toLowerCase().split(/[,\s]+/).every((p) => !p || lower.includes(p.toLowerCase()))) {
        score = Math.max(score, 0.95);
      } else if (year && (lower.includes(year) || (sourceDate && sourceDate.startsWith(year)))) {
        score = Math.max(score, 0.8);
      }
    } else {
      const resolved = d.resolved;
      if (sourceDate && resolved) {
        const diff = Math.abs(new Date(sourceDate).getTime() - new Date(resolved).getTime()) / 86400000;
        if (diff <= 3) score = Math.max(score, 0.9);
        else if (diff <= 21) score = Math.max(score, 0.6);
        else score = Math.max(score, 0.25);
      } else if (/\b(today|this week|yesterday|tonight|this morning)\b/.test(lower)) {
        score = Math.max(score, 0.7);
      }
    }
  }
  return clamp(score, 0, 1);
}

export function assessPassage(
  claim: TextAnalysis,
  source: {
    title: string;
    publisher: string;
    url: string | null;
    date: string | null;
    origin: EvidenceOrigin;
    body: string;
  },
): PassageAssessment {
  const body = `${source.title}. ${source.body}`.replace(/\s+/g, " ").trim();
  const claimTokens = tokenize(claim.normalizedClaim);
  const docTokens = tokenize(body);
  const claimWords = rawWords(claim.normalizedClaim);
  const docWords = rawWords(body);
  const claimCoverage = coverage(claimTokens, docTokens);

  const entities = [
    ...claim.locations,
    ...claim.organizations,
    ...claim.entities.map((e) => e.text),
  ].filter((e, i, arr) => e && arr.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);

  const entityMatch = entities.length ? entityHits(entities, body) : claimCoverage;
  const locationMatch = claim.locations.length ? entityHits(claim.locations, body) : 0.7;

  const entityTokenSet = new Set(entities.flatMap((e) => tokenize(e)));
  const extraTokens = claimTokens.filter((t) => !entityTokenSet.has(t) && t.length > 2);
  const extraCoverage = extraTokens.length ? coverage(extraTokens, docTokens) : 1;

  const claimPreds = claimWords.filter((w) => PREDICATES.has(w) || claim.events.includes(w));
  const eventMatch = claimPreds.length
    ? coverage(claimPreds, docWords)
    : extraTokens.length
      ? extraCoverage
      : Math.max(claimCoverage, entityHits(claim.events, body));

  const claimNums = extractNumbers(claim.normalizedClaim);
  const docNums = new Set(extractNumbers(body));
  const numericalMatch = claimNums.length
    ? claimNums.filter((n) => docNums.has(n)).length / claimNums.length
    : 0.7;

  let dateMatch = dateMatchScore(claim, body, source.date);
  const claimYears: string[] = claim.normalizedClaim.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const docYears: string[] = body.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (claimYears.length) {
    const yearHit = claimYears.filter((y) => docYears.includes(y)).length / claimYears.length;
    const extraYears = docYears.some((y) => !claimYears.includes(y));
    if (yearHit === 0 && docYears.length) dateMatch = Math.min(dateMatch, 0.12);
    else if (extraYears) dateMatch = Math.min(dateMatch, 0.24);
    else if (yearHit >= 1) dateMatch = Math.max(dateMatch, 0.86);
  }
  const negated =
    localNegation(docWords, claimPreds.length ? claimPreds : extraTokens) ||
    extraTokens.some((tok) => tokenNegated(docWords, tok));
  const clash = antonymClash(claimWords, docWords);
  const destructionVsExistence =
    DESTRUCTION_CLAIM.test(claim.normalizedClaim) &&
    EXISTENCE_PHRASES.some((p) => body.toLowerCase().includes(p)) &&
    entityMatch >= 0.4;

  const titleCoverage = coverage(claimTokens, tokenize(source.title));
  const directSentence = sentences(body).some((s) => coverage(claimTokens, tokenize(s)) >= 0.55);
  const directness = clamp(
    (directSentence ? 0.55 : 0.2) + titleCoverage * 0.25 + claimCoverage * 0.35 + eventMatch * 0.15,
    0,
    1,
  );

  const credibility = sourceCredibility(source);
  const excerpt = bestExcerpt(source.body || source.title, claimTokens);

  let evidenceClass: EvidenceClass = "INSUFFICIENT";
  const aligned =
    extraCoverage >= 0.5 &&
    (claimCoverage >= 0.5 || (entityMatch >= 0.45 && (eventMatch >= 0.4 || extraCoverage >= 0.6)));
  const weaklyAligned = claimCoverage >= 0.28 || entityMatch >= 0.35;

  if (!weaklyAligned && claimCoverage < 0.22) {
    evidenceClass = "INSUFFICIENT";
  } else if ((negated || clash || destructionVsExistence) && (aligned || entityMatch >= 0.4 || extraCoverage >= 0.45)) {
    evidenceClass = "CONTRADICTS";
  } else if (aligned && !negated && !clash && !destructionVsExistence) {
    evidenceClass = "SUPPORTS";
  } else if (weaklyAligned && (negated || clash || destructionVsExistence)) {
    evidenceClass = "CONTRADICTS";
  } else if (weaklyAligned) {
    evidenceClass = "NEUTRAL";
  } else {
    evidenceClass = "INSUFFICIENT";
  }

  if (
    evidenceClass === "SUPPORTS" &&
    /\b(does not prove|cannot be confirmed|not equivalent|not proof|unsourced image|does not mean|are not event confirmation)\b/i.test(
      body,
    )
  ) {
    evidenceClass = "INSUFFICIENT";
  }



  const stance: EvidenceStance =
    evidenceClass === "SUPPORTS" ? "support" : evidenceClass === "CONTRADICTS" ? "contradict" : "neutral";

  return {
    evidenceClass,
    stance,
    directness: round2(directness),
    entityMatch: round2(entityMatch),
    eventMatch: round2(eventMatch),
    dateMatch: round2(dateMatch),
    locationMatch: round2(locationMatch),
    numericalMatch: round2(numericalMatch),
    credibility: round2(credibility),
    claimCoverage: round2(claimCoverage),
    independenceKey: independenceKey(source),
    relevantExcerpt: excerpt,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function applyAssessment(item: EvidenceItem, claim: TextAnalysis, fullText?: string): EvidenceItem {
  const assessment = assessPassage(claim, {
    title: item.title,
    publisher: item.publisher,
    url: item.url,
    date: item.date,
    origin: item.origin,
    body: fullText || item.passage,
  });
  return {
    ...item,
    stance: assessment.stance,
    passage: assessment.relevantExcerpt || item.passage,
    relevance: clamp(
      assessment.claimCoverage * 0.45 +
        assessment.entityMatch * 0.25 +
        assessment.directness * 0.2 +
        assessment.credibility * 0.1,
      0.02,
      0.99,
    ),
    evidenceClass: assessment.evidenceClass,
    credibility: assessment.credibility,
    directness: assessment.directness,
    entityMatch: assessment.entityMatch,
    eventMatch: assessment.eventMatch,
    dateMatch: assessment.dateMatch,
    locationMatch: assessment.locationMatch,
    numericalMatch: assessment.numericalMatch,
    claimCoverage: assessment.claimCoverage,
  };
}
