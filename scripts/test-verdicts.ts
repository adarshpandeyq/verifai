import { analyzeText } from "../src/lib/pipeline/text-analysis";
import { applyAssessment } from "../src/lib/pipeline/stance";
import { classifyVerification } from "../src/lib/pipeline/classify";
import { emptyConcepts } from "../src/lib/pipeline/concepts";
import type { EvidenceItem, ImageAnalysis } from "../src/lib/types";

function blankImage(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
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
    ...overrides,
  };
}

function source(
  partial: Omit<EvidenceItem, "stance" | "relevance" | "id"> & { id?: string },
): EvidenceItem {
  return {
    id: partial.id ?? partial.title,
    title: partial.title,
    publisher: partial.publisher,
    url: partial.url,
    date: partial.date,
    passage: partial.passage,
    origin: partial.origin,
    stance: "neutral",
    relevance: 0.5,
  };
}

function run(claim: string, raw: EvidenceItem[], live = true) {
  const text = analyzeText(claim);
  const items = raw.map((item) => applyAssessment(item, text, `${item.title}. ${item.passage}`));
  const result = classifyVerification({
    text,
    image: blankImage(),
    consistency: null,
    evidence: items,
    evidenceMode: live ? "live" : "local_fallback",
    liveSucceeded: live,
  });
  return { result, items, text };
}

const cases: { name: string; claim: string; items: EvidenceItem[]; expect: string; live?: boolean }[] = [
  {
    name: "three independent confirming news sources",
    claim: "Jordan Hale won the 2024 presidential election.",
    expect: "TRUE",
    items: [
      source({
        title: "Hale wins presidential election",
        publisher: "Reuters",
        url: "https://www.reuters.com/world/hale-wins-2024",
        date: "2024-11-06",
        origin: "web_search",
        passage:
          "Jordan Hale won the 2024 presidential election, electoral officials said on Wednesday, after the remaining states were called.",
      }),
      source({
        title: "Hale projected winner",
        publisher: "BBC",
        url: "https://www.bbc.com/news/hale-wins",
        date: "2024-11-06",
        origin: "web_search",
        passage:
          "Jordan Hale has won the 2024 presidential election after a projected victory, the BBC can report.",
      }),
      source({
        title: "Official results",
        publisher: "Election Commission",
        url: "https://results.gov.example/2024",
        date: "2024-11-06",
        origin: "web_search",
        passage:
          "The official election authority confirms Jordan Hale as the winner of the 2024 presidential election.",
      }),
    ],
  },
  {
    name: "one authoritative primary source is enough",
    claim: "Jordan Hale won the 2024 presidential election.",
    expect: "TRUE",
    items: [
      source({
        title: "Certified result",
        publisher: "National Electoral Commission",
        url: "https://elections.gov.example/certified",
        date: "2024-11-07",
        origin: "web_search",
        passage:
          "The National Electoral Commission hereby confirms that Jordan Hale won the 2024 presidential election.",
      }),
    ],
  },
  {
    name: "stable geographic fact",
    claim: "Paris is the capital of France.",
    expect: "TRUE",
    items: [
      source({
        title: "Paris",
        publisher: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Paris",
        date: "2025-01-01",
        origin: "wikipedia",
        passage:
          "Paris is the capital and most populous city of France. Since the 17th century, Paris has been one of the world's major centres of finance, diplomacy, commerce, and culture.",
      }),
    ],
  },
  {
    name: "scientific fact",
    claim: "Water boils at 100°C at standard atmospheric pressure.",
    expect: "TRUE",
    items: [
      source({
        title: "Boiling point of water at standard pressure",
        publisher: "Local demonstration corpus",
        url: null,
        date: null,
        origin: "local_corpus",
        passage:
          "At standard atmospheric pressure (1 atm / 101.325 kPa), pure water boils at 100°C (212°F). The boiling point falls at higher altitude as pressure decreases.",
      }),
    ],
    live: false,
  },
  {
    name: "existence contradicts destruction claim",
    claim: "The Eiffel Tower was dismantled last night.",
    expect: "FALSE",
    items: [
      source({
        title: "Eiffel Tower",
        publisher: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Eiffel_Tower",
        date: "2025-03-01",
        origin: "wikipedia",
        passage:
          "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It remains a standing monument and a working attraction.",
      }),
    ],
  },
  {
    name: "direct medical contradiction",
    claim: "WHO declared coffee a cure for all cancers.",
    expect: "FALSE",
    items: [
      source({
        title: "Coffee is not a universal cancer cure",
        publisher: "Local demonstration corpus",
        url: null,
        date: null,
        origin: "local_corpus",
        passage:
          "Coffee is not a cure for all cancers. The World Health Organization’s IARC has evaluated coffee and does not classify it as a cancer treatment.",
      }),
      source({
        title: "Coffee and cancer",
        publisher: "World Health Organization",
        url: "https://www.who.int/news-room/coffee",
        date: "2016-06-15",
        origin: "web_search",
        passage:
          "WHO does not declare coffee a cure for cancer. Coffee is not classified as a cancer treatment.",
      }),
    ],
  },
  {
    name: "unrelated thin snippets stay unverified",
    claim: "A secret moon base opened in Ohio this morning.",
    expect: "UNVERIFIED",
    items: [
      source({
        title: "Ohio weather",
        publisher: "Local blog",
        url: "https://example.net/ohio-weather",
        date: "2024-02-02",
        origin: "web_search",
        passage: "Clouds moved across Ohio this morning as temperatures stayed near average.",
      }),
    ],
  },
  {
    name: "related event with wrong year is misleading",
    claim: "Jordan Hale won the 2016 presidential election.",
    expect: "MISLEADING",
    items: [
      source({
        title: "Hale wins 2024 race",
        publisher: "Reuters",
        url: "https://www.reuters.com/world/hale-2024",
        date: "2024-11-06",
        origin: "web_search",
        passage:
          "Jordan Hale won the 2024 presidential election, according to official projections. He did not run in 2016.",
      }),
      source({
        title: "Hale projected winner 2024",
        publisher: "BBC",
        url: "https://www.bbc.com/news/hale-2024",
        date: "2024-11-06",
        origin: "web_search",
        passage: "Jordan Hale has won the 2024 presidential election after a projected victory.",
      }),
    ],
  },
];

async function main() {
  let failed = 0;
  for (const test of cases) {
    const { result, items } = run(test.claim, test.items, test.live !== false);
    const ok = result.verdict === test.expect;
    if (!ok) failed += 1;
    const classes = items.map((i) => `${i.evidenceClass || i.stance}`).join(", ");
    console.log(
      `${ok ? "PASS" : "FAIL"} | ${test.name}\n  expected ${test.expect} got ${result.verdict} (${result.aggregation.reasonCode})\n  ${result.aggregation.debugSummary}\n  classes: ${classes}\n`,
    );
  }
  if (failed) {
    console.error(`Failed ${failed}/${cases.length}`);
    process.exit(1);
  }
  console.log(`All ${cases.length} synthetic cases passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
