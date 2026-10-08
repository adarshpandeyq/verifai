"use client";

import { useEffect, useState } from "react";

type Slide = {
  kicker: string;
  title: string;
  body: string;
  aside: string;
  points?: string[];
};

const SLIDES: Slide[] = [
  {
    kicker: "01 — Title",
    title: "VERIFAI",
    body: "A working multimodal misinformation verifier. The user submits a text claim and an optional image. The system analyses language, reads the picture, retrieves evidence, then returns TRUE, FALSE, MISLEADING, or UNVERIFIED with a confidence score that actually changes with the input.",
    aside: "B.Sc. Artificial Intelligence project — runnable demo, not a slide-only proposal.",
    points: [
      "Frontend + API: Next.js App Router, TypeScript, Tailwind",
      "Store: PostgreSQL through Drizzle ORM",
      "Vision lite: Sharp (pixels, colour, EXIF)",
      "Evidence: Wikipedia, Google News, GDELT, DuckDuckGo, OpenAlex",
    ],
  },
  {
    kicker: "02 — Problem",
    title: "Resemblance is treated as proof.",
    body: "A flood photograph next to “the airport shut today” feels true because the picture matches the words. That is the failure mode. Recycled images, wrong cities, wrong years, and absolute wording (“completely shut”) travel faster than official notices.",
    aside: "The product rule: text–image similarity is not a truth signal.",
    points: [
      "Old disaster photos get new captions every monsoon.",
      "A portrait plus “RIP” is not an obituary.",
      "Screenshots of fake WHO graphics circulate as policy.",
      "Landmark hoaxes (tower dismantled overnight) repeat yearly.",
    ],
  },
  {
    kicker: "03 — User flow",
    title: "Claim. Frame. Ledger.",
    body: "Paste a statement, clip an image if you have one, hit Verify. Stages light up in order. The report shows scores, why-this-result bullets, supporting and contradicting cards, and a history rail you can reopen.",
    aside: "⌘/Ctrl + Enter also runs the pipeline.",
    points: [
      "Image preview before submit (client-side compress).",
      "SSE stream so stages are real, not a fake spinner.",
      "History saved — click any row for the full report.",
      "New verification resets the workspace without losing the ledger.",
    ],
  },
  {
    kicker: "04 — Pipeline A: language + vision",
    title: "What the machines actually compute.",
    body: "Text analysis pulls locations, organisations, events, relative dates (“today”), and absolute wording. Image analysis is not a black-box captioner here: Sharp reads a 64×64 raster, colour histograms, edge energy, and EXIF timestamps. Both sides fill a 16-D concept vector (water, fire, urban, night…).",
    aside: "CLIP would be the production embedding. The concept space is the explainable stand-in.",
    points: [
      "Cosine(text concepts, image concepts) → consistency %",
      "EXIF date vs “today” → recycled-image flag",
      "High consistency + thin evidence → often MISLEADING",
      "No image → language and evidence only",
    ],
  },
  {
    kicker: "05 — Pipeline B: evidence",
    title: "Read the passage. Then vote.",
    body: "Search queries are built from the claim. Live sources are fetched when the network allows. Each page is classified SUPPORTS / CONTRADICTS / NEUTRAL / INSUFFICIENT by entity match, event match, dates, numbers, and negation around the claim — not by a random “not” in the article.",
    aside: "One official source can be enough. Several independent newsrooms can be enough. Snippets alone are not.",
    points: [
      "Wikipedia lead extracts + real article URLs",
      "Google News RSS and GDELT for publisher links that open",
      "DuckDuckGo + OpenAlex (science claims)",
      "Local corpus is labelled. No fake URLs.",
    ],
  },
  {
    kicker: "06 — Aggregation",
    title: "Scores, then a bounded verdict.",
    body: "Support score, contradiction score, source quality, independence, directness, temporal match, entity match. TRUE if strong support and no strong contradiction. FALSE if reliable contradiction. MISLEADING if the event is real but the date, place, person, or picture is wrong. UNVERIFIED if the record is thin.",
    aside: "The report prints: Supporting X · Contradicting Y · Independent Z · Strength · Verdict.",
    points: [
      "Do not require exactly three sources.",
      "Do not invent certainty from a matching photo.",
      "Do not fabricate URLs.",
      "UNVERIFIED is a valid scientific output.",
    ],
  },
  {
    kicker: "07 — Four labels",
    title: "TRUE / FALSE / MISLEADING / UNVERIFIED",
    body: "TRUE is for claims the passages actually confirm. FALSE is for claims the record contradicts. MISLEADING is the important middle: flooding may be in the frame, but “Mumbai Airport completely shut today” is not thereby proven. UNVERIFIED is what you say when you do not know.",
    aside: "Viva line: we would rather under-claim than hallucinate a newsroom.",
    points: [
      "Water boils at 100°C at 1 atm → typically TRUE",
      "Eiffel Tower dismantled last night → typically FALSE",
      "Airport shut today + flood photo → MISLEADING / UNVERIFIED",
      "Secret moon base in Ohio → UNVERIFIED",
    ],
  },
  {
    kicker: "08 — Demo script",
    title: "Four runs, four different shapes.",
    body: "Use the sample chips, or type your own. Attach any picture — even an unrelated one — and watch consistency move. Open a source with Open source ↗. Click history. Start another verification.",
    aside: "If live news is blocked, the local corpus still demonstrates the logic and is labelled as such.",
    points: [
      "Airport flooding today + water-like image",
      "Eiffel Tower dismantled last night",
      "WHO coffee cure for all cancers",
      "Paris is the capital of France / boiling point",
    ],
  },
  {
    kicker: "09 — Stack & config",
    title: "What to name in a viva.",
    body: "Next.js, TypeScript, Tailwind, Drizzle, PostgreSQL, Sharp. Optional env: DATABASE_URL, TAVILY_API_KEY / SERPER_API_KEY / SEARCH_API_KEY, OPENAI_API_KEY, WIKIPEDIA_ENABLED. Python CLIP can be a later sidecar; it is not required for the preview.",
    aside: "Explain the concept vector first. Mention CLIP as the upgrade path.",
    points: [
      "POST /api/verify — SSE stages then saved report",
      "GET /api/verifications — history",
      "GET /api/open?u= — bounce so source links open",
      "GET /api/health — database ping",
    ],
  },
  {
    kicker: "10 — Limits",
    title: "What this is not.",
    body: "Not a court. Not a newsroom CMS. Not a full CLIP / LLM fact-checker unless you plug keys in. Live web can fail in a sandbox; then the app falls back honestly. Scores are computed, but they are a student-scale model, not a production trust-and-safety stack.",
    aside: "The honest limitation is part of the grade.",
    points: [
      "No invented citations.",
      "No hardcoded 87% for every claim.",
      "No claim that visual match equals truth.",
      "Future work: CLIP embeddings, geolocation, reverse image search.",
    ],
  },
];

export function ProjectBriefing({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [autoplay, setAutoplay] = useState(false);
  const slide = SLIDES[index];

  const go = (next: number, direction: "fwd" | "back") => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    setDir(direction);
    setIndex(clamped);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(index + 1, "fwd");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1, "back");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose]);

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setInterval(() => {
      setDir("fwd");
      setIndex((i) => (i >= SLIDES.length - 1 ? 0 : i + 1));
    }, 5200);
    return () => window.clearInterval(t);
  }, [autoplay]);

  return (
    <div className="deck-root" role="dialog" aria-modal="true" aria-label="Project briefing">
      <div className="deck-stage">
        <div className="deck-progress" style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }} />
        <div className="deck-top">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--gold)]">
            Project briefing · {String(index + 1).padStart(2, "0")}/{String(SLIDES.length).padStart(2, "0")}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn px-3 py-1 text-xs ${autoplay ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setAutoplay((v) => !v)}
            >
              {autoplay ? "Autoplay on" : "Autoplay"}
            </button>
            <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="deck-body">
          <nav className="deck-index" aria-label="Slides">
            {SLIDES.map((s, i) => (
              <button
                key={s.kicker}
                type="button"
                className={`deck-index-item ${i === index ? "on" : ""}`}
                onClick={() => go(i, i > index ? "fwd" : "back")}
              >
                <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                {s.kicker.replace(/^\d+\s—\s/, "")}
              </button>
            ))}
          </nav>

          <div key={`${index}-${dir}`} className={`deck-slide deck-anim-${dir}`}>
            <p className="kicker m-0">{slide.kicker}</p>
            <h2 className="display m-0 mt-3 text-3xl leading-tight sm:text-[2.6rem]">{slide.title}</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">{slide.body}</p>
            {slide.points?.length ? (
              <ul className="deck-points">
                {slide.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
            <p className="deck-aside mt-6">{slide.aside}</p>
          </div>
        </div>

        <div className="deck-nav">
          <button
            type="button"
            className="btn btn-ghost px-4 py-2 text-xs"
            onClick={() => go(index - 1, "back")}
            disabled={index === 0}
          >
            Prev
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.kicker}
                type="button"
                aria-label={`Go to ${s.kicker}`}
                className={`h-2 w-2 rounded-full transition-transform ${
                  i === index ? "scale-125 bg-[var(--gold)]" : "bg-[var(--line-strong)]"
                }`}
                onClick={() => go(i, i > index ? "fwd" : "back")}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary px-4 py-2 text-xs"
            onClick={() => {
              if (index === SLIDES.length - 1) onClose();
              else go(index + 1, "fwd");
            }}
          >
            {index === SLIDES.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
