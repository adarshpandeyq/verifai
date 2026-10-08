"use client";

export function ScoreRing({
  value,
  label,
  tone = "gold",
}: {
  value: number | null;
  label: string;
  tone?: "gold" | "teal" | "false" | "muted";
}) {
  const size = 108;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = value ?? 0;
  const offset = c - (Math.max(0, Math.min(100, shown)) / 100) * c;
  const color =
    tone === "teal"
      ? "var(--teal)"
      : tone === "false"
        ? "var(--false)"
        : tone === "muted"
          ? "var(--unverified)"
          : "var(--gold)";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--paper) 12%, transparent)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={value === null ? c : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--paper)"
          fontSize="22"
          fontFamily="var(--font-mono-family), ui-monospace, monospace"
        >
          {value === null ? "—" : `${Math.round(value)}`}
        </text>
      </svg>
      <p className="m-0 max-w-[120px] text-center text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}
