"use client";

import type { PipelineStageId, StageStatus } from "@/lib/types";

const STAGES: { id: PipelineStageId; label: string }[] = [
  { id: "text", label: "Text analysis" },
  { id: "image", label: "Image analysis" },
  { id: "consistency", label: "Text–image comparison" },
  { id: "evidence", label: "Evidence retrieval" },
  { id: "evidence_analysis", label: "Evidence analysis" },
  { id: "final", label: "Final verification" },
];

export function StageTimeline({
  statuses,
  details,
}: {
  statuses: Record<PipelineStageId, StageStatus>;
  details: Partial<Record<PipelineStageId, string>>;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {STAGES.map((stage, index) => {
        const status = statuses[stage.id];
        return (
          <li key={stage.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <StatusMark status={status} />
              {index < STAGES.length - 1 ? (
                <span className="mt-1 h-6 w-px bg-[var(--line-strong)]" />
              ) : null}
            </div>
            <div className="pt-[1px]">
              <p className="m-0 text-sm font-medium">{stage.label}</p>
              <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">
                {status === "running"
                  ? details[stage.id] || "Working…"
                  : status === "complete"
                    ? "Complete"
                    : status === "error"
                      ? "Failed"
                      : "Waiting"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusMark({ status }: { status: StageStatus }) {
  if (status === "complete") {
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--teal-dim)] text-[11px] text-[var(--teal)]">
        ✓
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="grid h-6 w-6 place-items-center">
        <span className="pulse-dot" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[color-mix(in_srgb,var(--false)_18%,transparent)] text-[11px] text-[var(--false)]">
        !
      </span>
    );
  }
  return <span className="mt-1 h-3 w-3 rounded-full border border-[var(--line-strong)]" />;
}

export { STAGES };
