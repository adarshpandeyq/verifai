"use client";

import type { VerificationRecord, Verdict } from "@/lib/types";

export function HistoryRail({
  items,
  activeId,
  onSelect,
  onDelete,
}: {
  items: VerificationRecord[];
  activeId: number | null;
  onSelect: (item: VerificationRecord) => void;
  onDelete: (id: number) => void;
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <img src="/images/empty-lens.png" alt="" className="mb-4 h-28 w-28 rounded-2xl object-cover opacity-80" />
        <p className="m-0 text-sm text-[var(--muted)]">No verifications yet. Run a claim to build a ledger.</p>
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={`flex w-full gap-3 rounded-2xl border p-2.5 text-left transition ${
                active ? "border-[var(--gold)] bg-[var(--gold-dim)]" : "hairline bg-transparent hover:bg-[var(--elev-2)]"
              }`}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--bg)]">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] text-[var(--faint)]">No img</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <VerdictPill verdict={item.verdict} />
                  <span className="mono text-[10px] text-[var(--faint)]">{item.confidence}%</span>
                </div>
                <p className="m-0 mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--paper)]">{item.claim}</p>
                <p className="m-0 mt-1 text-[10px] text-[var(--faint)]">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                className="text-[11px] text-[var(--faint)] hover:text-[var(--false)]"
                onClick={() => onDelete(item.id)}
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const icon = verdict === "TRUE" ? "●" : verdict === "FALSE" ? "●" : verdict === "MISLEADING" ? "▲" : "○";
  return (
    <span className={`mono text-[10px] tracking-[0.14em] verdict-${verdict}`}>
      {icon} {verdict}
    </span>
  );
}
