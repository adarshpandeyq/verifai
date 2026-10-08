"use client";

import { useRef } from "react";

const SAMPLES = [
  {
    label: "Airport flooding",
    text: "Mumbai Airport was completely shut because of flooding today.",
  },
  {
    label: "Eiffel Tower",
    text: "The Eiffel Tower was dismantled last night.",
  },
  {
    label: "Coffee cure",
    text: "WHO declared coffee a cure for all cancers.",
  },
  {
    label: "Boiling point",
    text: "Water boils at 100°C at standard atmospheric pressure.",
  },
  {
    label: "Paris capital",
    text: "Paris is the capital of France.",
  },
  {
    label: "Flat Earth",
    text: "NASA admitted the Earth is flat last week.",
  },
  {
    label: "Sun in the west",
    text: "The Sun will rise in the west tomorrow.",
  },
  {
    label: "Tokyo capital",
    text: "Tokyo is the capital of Japan.",
  },
];

export function Composer({
  claim,
  setClaim,
  preview,
  onFile,
  onClearImage,
  onVerify,
  busy,
  error,
}: {
  claim: string;
  setClaim: (v: string) => void;
  preview: string | null;
  onFile: (file: File | null) => void;
  onClearImage: () => void;
  onVerify: () => void;
  busy: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card overflow-hidden">
      <div className="relative h-36 overflow-hidden sm:h-44">
        <img src="/images/hero-panel.jpg" alt="" className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--elev)] to-transparent" />
        <div className="absolute bottom-4 left-5 right-5">
          <p className="kicker m-0">Intake slip</p>
          <h2 className="display m-0 mt-1 text-2xl sm:text-3xl">Write the claim. Clip the picture.</h2>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <label className="mb-2 block text-sm text-[var(--muted)]" htmlFor="claim">
          Paste your claim here
        </label>
        <textarea
          id="claim"
          className="claim-box"
          placeholder="e.g. Mumbai Airport was completely shut because of flooding today."
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onVerify();
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button key={sample.label} type="button" className="chip" onClick={() => setClaim(sample.text)}>
              {sample.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
          <button
            type="button"
            className="dropzone flex min-h-[160px] flex-col items-center justify-center gap-2 px-4 py-6 text-center"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("hot");
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove("hot")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("hot");
              const file = e.dataTransfer.files?.[0];
              if (file) onFile(file);
            }}
          >
            <span className="kicker">Upload image</span>
            <span className="text-sm text-[var(--muted)]">JPEG, PNG, WebP · drag & drop or click</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </button>

          <div className="overflow-hidden rounded-2xl hairline bg-[var(--bg)]">
            {preview ? (
              <div className="relative h-full min-h-[160px]">
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="btn btn-ghost absolute right-2 top-2 px-3 py-1 text-xs"
                  onClick={onClearImage}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="grid min-h-[160px] place-items-center p-4 text-center text-xs text-[var(--faint)]">
                Image preview
              </div>
            )}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--false)_40%,transparent)] bg-[color-mix(in_srgb,var(--false)_12%,transparent)] px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-xs text-[var(--faint)]">⌘/Ctrl + Enter to run</p>
          <button type="button" className="btn btn-primary px-8 py-3 text-sm" disabled={busy} onClick={onVerify}>
            {busy ? "Verifying…" : "Verify claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
