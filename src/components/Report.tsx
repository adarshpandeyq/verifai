"use client";

import type { EvidenceItem, VerificationRecord } from "@/lib/types";
import { ScoreRing } from "@/components/ScoreRing";
import { VerdictPill } from "@/components/HistoryRail";

export function Report({
  record,
  onNew,
}: {
  record: VerificationRecord;
  onNew: () => void;
}) {
  const supporting = record.evidence.filter((e) => e.stance === "support");
  const contradicting = record.evidence.filter((e) => e.stance === "contradict");
  const neutral = record.evidence.filter((e) => e.stance === "neutral");
  const banner =
    record.verdict === "TRUE"
      ? { icon: "●", label: "TRUE" }
      : record.verdict === "FALSE"
        ? { icon: "●", label: "FALSE" }
        : record.verdict === "MISLEADING"
          ? { icon: "▲", label: "MISLEADING" }
          : { icon: "○", label: "UNVERIFIED" };

  return (
    <div className="rise flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker m-0">Verification result</p>
          <h2 className={`display m-0 mt-2 text-4xl font-medium tracking-tight verdict-${record.verdict} sm:text-5xl`}>
            {banner.icon} {banner.label}
          </h2>
        </div>
        <button type="button" className="btn btn-ghost px-4 py-2 text-sm" onClick={onNew}>
          New verification
        </button>
      </div>

      <div className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-6">
            <ScoreRing value={record.confidence} label="Confidence" tone="gold" />
            <ScoreRing
              value={record.textImageConsistency}
              label="Text–image consistency"
              tone="teal"
            />
            <ScoreRing value={record.evidenceSupport} label="Evidence support" tone="teal" />
            <ScoreRing value={record.evidenceContradiction} label="Evidence contradiction" tone="false" />
          </div>
          {record.thumbnail ? (
            <img
              src={record.thumbnail}
              alt="Submitted visual"
              className="h-28 w-36 rounded-2xl object-cover hairline"
            />
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl bg-[color-mix(in_srgb,var(--bg)_55%,transparent)] p-4">
          <p className="kicker m-0">Claim</p>
          <p className="display m-0 mt-2 text-xl italic leading-snug">“{record.claim}”</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <ModeBadge record={record} />
          <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[var(--muted)]">
            {new Date(record.createdAt).toLocaleString()}
          </span>
          <VerdictPill verdict={record.verdict} />
        </div>
      </div>

      <aside className="rounded-2xl border border-[var(--line)] bg-[var(--gold-dim)] px-4 py-3 text-sm leading-relaxed text-[var(--paper)]">
        Text–image similarity is <strong>not</strong> proof of truth. An old or miscaptioned image can still score
        highly against a new claim.
      </aside>

      <section className="card p-5 sm:p-7">
        <p className="kicker m-0">Why this result?</p>
        <p className="m-0 mt-3 text-sm leading-relaxed text-[var(--muted)]">{record.summary}</p>
        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
          {record.reasoning.map((bullet, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm leading-relaxed"
            >
              <span className="mt-0.5 shrink-0">
                {bullet.kind === "support" ? "✓" : bullet.kind === "against" ? "✗" : "⚠"}
              </span>
              <span>{bullet.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AnalysisCard title="Text analysis" rows={textRows(record)} />
        <AnalysisCard title="Image analysis" rows={imageRows(record)} />
      </section>

      {record.consistency ? (
        <section className="card p-5 sm:p-7">
          <p className="kicker m-0">Shared concepts</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {record.consistency.overlappingConcepts.length ? (
              record.consistency.overlappingConcepts.map((row) => (
                <span key={row.concept} className="chip cursor-default">
                  {row.concept} · t {(row.text * 100).toFixed(0)}% / i {(row.image * 100).toFixed(0)}%
                </span>
              ))
            ) : (
              <p className="m-0 text-sm text-[var(--muted)]">No strong overlapping visual-language concepts.</p>
            )}
          </div>
        </section>
      ) : null}

      <section>
        <p className="kicker m-0 mb-3">Evidence</p>
        <EvidenceColumn title="Supporting evidence" items={supporting} empty="No supporting sources in this run." />
        <div className="h-4" />
        <EvidenceColumn
          title="Contradicting evidence"
          items={contradicting}
          empty="No contradicting sources in this run."
        />
        {neutral.length ? (
          <>
            <div className="h-4" />
            <EvidenceColumn title="Contextual / neutral" items={neutral} empty="" />
          </>
        ) : null}
      </section>
    </div>
  );
}

function ModeBadge({ record }: { record: VerificationRecord }) {
  const label =
    record.evidenceMode === "live"
      ? "Live retrieval"
      : record.evidenceMode === "mixed"
        ? "Mixed live + local corpus"
        : "Local demonstration corpus";
  return (
    <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[var(--muted)]">
      {label}
      {record.liveRetrievalSucceeded ? " · live hit" : " · no live hit"}
    </span>
  );
}

function AnalysisCard({ title, rows }: { title: string; rows: { k: string; v: string }[] }) {
  return (
    <div className="card p-5">
      <p className="kicker m-0">{title}</p>
      <dl className="m-0 mt-3 grid gap-2">
        {rows.map((row) => (
          <div key={row.k} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
            <dt className="text-[var(--faint)]">{row.k}</dt>
            <dd className="m-0">{row.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function textRows(record: VerificationRecord) {
  const t = record.textAnalysis;
  return [
    { k: "Main claim", v: t.mainClaim },
    { k: "Locations", v: t.locations.join(", ") || "—" },
    { k: "Events", v: t.events.join(", ") || "—" },
    { k: "Orgs", v: t.organizations.join(", ") || "—" },
    { k: "Time", v: t.timeReferences.join(", ") || "—" },
    { k: "Entities", v: t.entities.map((e) => `${e.text} (${e.type})`).join(", ") || "—" },
    { k: "Specificity", v: `${Math.round(t.specificity * 100)}%` },
    { k: "Sensationalism", v: `${Math.round(t.sensationalism * 100)}%` },
  ];
}

function imageRows(record: VerificationRecord) {
  const i = record.imageAnalysis;
  if (!i.hasImage) return [{ k: "Status", v: "No image uploaded" }];
  return [
    { k: "Size", v: `${i.width}×${i.height} ${i.format ?? ""}`.trim() },
    { k: "Concepts", v: i.conceptLabels.join(", ") || "—" },
    { k: "Brightness", v: `${Math.round(i.brightness * 100)}%` },
    { k: "Saturation", v: `${Math.round(i.saturation * 100)}%` },
    { k: "Edges", v: `${Math.round(i.edgeEnergy * 100)}%` },
    { k: "EXIF date", v: i.exifDate ? i.exifDate.replace("T", " ") : "None" },
    { k: "Notes", v: i.notes[2] || i.notes[0] || "—" },
  ];
}

function EvidenceColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: EvidenceItem[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 mt-0 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <div className="card flex items-center gap-3 p-4 text-sm text-[var(--muted)]">
          <img src="/images/evidence-empty.png" alt="" className="h-12 w-12 rounded-lg object-cover" />
          <span>{empty}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <article key={item.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="m-0 text-[15px] font-medium">{item.title}</h4>
                <OriginBadge origin={item.origin} />
              </div>
              <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                {item.publisher}
                {item.date ? ` · ${item.date}` : ""} · relevance {Math.round(item.relevance * 100)}%
              </p>
              <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--paper)]">{item.passage}</p>
              {item.url ? (
                <SourceActions url={item.url} />
              ) : (
                <p className="m-0 mt-2 text-xs text-[var(--faint)]">No live URL — local demonstration corpus</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function OriginBadge({ origin }: { origin: EvidenceItem["origin"] }) {
  const label = origin === "web_search" ? "NEWS / WEB" : origin === "wikipedia" ? "WIKIPEDIA" : "LOCAL CORPUS";
  return (
    <span className="mono rounded-full bg-[var(--elev-2)] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[var(--muted)]">
      {label}
    </span>
  );
}

function SourceActions({ url }: { url: string }) {
  const bounce = `/api/open?u=${encodeURIComponent(url)}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <a href={bounce} target="_blank" rel="noopener noreferrer" className="source-open">
        Open source ↗
      </a>
      <a href={url} target="_blank" rel="noopener noreferrer" className="source-direct">
        Direct link
      </a>
      <button
        type="button"
        className="source-direct"
        onClick={() => {
          void navigator.clipboard?.writeText(url);
        }}
      >
        Copy URL
      </button>
      <span className="mono max-w-full truncate text-[10px] text-[var(--faint)]">{url}</span>
    </div>
  );
}
