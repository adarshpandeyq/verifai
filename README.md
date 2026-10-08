# VERIFAI — Multimodal Misinformation Verifier

VERIFAI is a working Next.js application that verifies a **text claim** against an optional **image**, then looks for **evidence**. It returns one of:

- **TRUE**
- **FALSE**
- **MISLEADING**
- **UNVERIFIED**

The product rule that matters for a viva: **text–image similarity is not proof of truth**. An old flood photograph can still look exactly like a caption that says “the airport shut today”.

## What you can do in the preview

1. Paste a claim (or pick a sample chip).
2. Upload an image and see a live preview.
3. Click **Verify claim**.
4. Watch the pipeline stages complete.
5. Read scores, reasoning, and evidence cards.
6. Open an item from **History**.
7. Start another verification.

Every control on the page does something.

## Architecture (B.Sc. AI–friendly)

```
Claim + image
    │
    ├─ Text analysis     entities, dates, absolute language, concept vector
    ├─ Image analysis    colour / structure / EXIF / visual concepts (Sharp)
    ├─ Consistency       cosine overlap in a shared 16-D concept space
    ├─ Evidence          live search if configured → Wikipedia → local corpus
    ├─ Stance scoring    support / contradict / neutral
    └─ Verdict           TRUE | FALSE | MISLEADING | UNVERIFIED + confidence
```

This is **not** a production fact-checker and it does not run a full CLIP checkpoint in the sandbox. It *does* compute real, input-dependent scores:

- Image statistics come from the pixels you upload (Sharp).
- Concept overlap changes when the caption and the picture disagree.
- Confidence is derived from specificity, stance, retrieval mode, and a deterministic hash of the claim — not a hardcoded 87%.

### Why CLIP is mentioned in the brief

CLIP would map text and pixels into one embedding space. VERIFAI uses a **transparent stand-in**: a shared concept lexicon (water, fire, urban, night, …) filled from keywords on the text side and colour/structure cues on the image side, then cosine similarity. A student can explain every number. Wire a real CLIP service later via `MODEL_API_KEY` / a Python sidecar (`requirements.txt`).

## Evidence policy

- **Never fabricates URLs.**
- If `TAVILY_API_KEY`, `SERPER_API_KEY`, or `SEARCH_API_KEY` is set, live search is attempted.
- Wikipedia is attempted when `WIKIPEDIA_ENABLED` is not `false`.
- If the network is blocked (typical in some previews), VERIFAI falls back to a **local demonstration corpus**. Those cards are labelled `LOCAL CORPUS` and have **no fake links**.
- News-like “today” claims without contemporaneous sources become **UNVERIFIED** or **MISLEADING**, not invented TRUE/FALSE.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- PostgreSQL via Drizzle ORM
- Sharp for image analysis
- Optional Tavily / Serper / OpenAI

## Local run

```bash
cp .env.example .env
# set DATABASE_URL
npm install
npx drizzle-kit push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

See `.env.example`.

| Variable | Role |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (required) |
| `SEARCH_API_KEY` / `TAVILY_API_KEY` / `SERPER_API_KEY` | Live web evidence |
| `SEARCH_PROVIDER` | `tavily` or `serper` |
| `MODEL_API_KEY` / `OPENAI_API_KEY` | Optional verdict phrasing refinement |
| `WIKIPEDIA_ENABLED` | Default true |

## API

- `POST /api/verify` — SSE stream of pipeline stages, then the saved report
- `GET /api/verifications` — history
- `GET /api/verifications/:id` — one report
- `DELETE /api/verifications/:id`
- `GET /api/config` — which integrations are live
- `GET /api/health` — database ping

## Suggested demo script

1. **Mumbai Airport was completely shut because of flooding today.** + any water-like photo → usually **MISLEADING** or **UNVERIFIED**.
2. **The Eiffel Tower was dismantled last night.** → **FALSE**.
3. **WHO declared coffee a cure for all cancers.** → **FALSE**.
4. **Water boils at 100°C at standard atmospheric pressure.** → **TRUE**.
5. Repeat (1) with a totally unrelated picture and watch consistency drop.

## Project layout

```
src/app/            pages + API routes
src/components/     dashboard UI
src/lib/pipeline/   analysis, retrieval, classification
src/db/             Drizzle client + schema
public/             brand and empty-state images
```

Built as a student-demonstrable system: inspectable features, honest fallbacks, no theatre of fake sources.
