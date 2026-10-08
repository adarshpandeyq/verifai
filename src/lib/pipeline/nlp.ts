import { unique } from "@/lib/pipeline/math";

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "of",
  "to",
  "in",
  "on",
  "for",
  "from",
  "by",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "with",
  "without",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "through",
  "during",
  "than",
  "then",
  "so",
  "such",
  "not",
  "no",
  "nor",
  "too",
  "very",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might",
  "will",
  "just",
  "also",
  "more",
  "most",
  "some",
  "any",
  "our",
  "your",
  "their",
  "his",
  "her",
  "they",
  "them",
  "we",
  "you",
  "he",
  "she",
  "i",
  "me",
  "my",
  "because",
  "due",
  "has",
  "have",
  "had",
  "does",
  "did",
  "do",
  "up",
  "out",
  "off",
  "via",
]);

export function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'%°c.-]/g, " ")
    .split(/[\s/,_]+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export function containsPhrase(haystack: string, needle: string): boolean {
  const h = ` ${haystack.toLowerCase()} `;
  const n = needle.toLowerCase();
  if (n.includes(" ")) return h.includes(` ${n} `) || haystack.toLowerCase().includes(n);
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);
}

export function findPhrases(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    if (containsPhrase(lower, phrase)) hits.push(phrase);
  }
  return unique(hits);
}

export function overlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bs = new Set(b.map((x) => x.toLowerCase()));
  let hit = 0;
  for (const tok of a) {
    if (bs.has(tok.toLowerCase())) hit += 1;
  }
  return hit / Math.sqrt(a.length * b.length);
}

export function extractMainClaim(text: string): string {
  const cleaned = normalizeText(text).replace(/^["']|["']$/g, "");
  const first = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  return first.slice(0, 280);
}

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december";

export function extractAbsoluteDates(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    new RegExp(`\\b(${MONTHS})\\s+\\d{1,2}(?:,\\s*\\d{4})?\\b`, "gi"),
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b(?:19|20)\d{2}\b/g,
  ];
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) found.push(...matches);
  }
  return unique(found);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
