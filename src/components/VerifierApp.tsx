"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Composer } from "@/components/Composer";
import { HistoryRail } from "@/components/HistoryRail";
import { Report } from "@/components/Report";
import { StageTimeline } from "@/components/Stages";
import { ProjectBriefing } from "@/components/ProjectBriefing";
import type {
  PipelineStageId,
  PublicConfig,
  StageStatus,
  VerificationRecord,
  VerifyEvent,
} from "@/lib/types";

const STAGE_IDS: PipelineStageId[] = [
  "text",
  "image",
  "consistency",
  "evidence",
  "evidence_analysis",
  "final",
];

function idleStatuses(): Record<PipelineStageId, StageStatus> {
  return {
    text: "idle",
    image: "idle",
    consistency: "idle",
    evidence: "idle",
    evidence_analysis: "idle",
    final: "idle",
  };
}

export function VerifierApp() {
  const [claim, setClaim] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState(idleStatuses);
  const [details, setDetails] = useState<Partial<Record<PipelineStageId, string>>>({});
  const [result, setResult] = useState<VerificationRecord | null>(null);
  const [history, setHistory] = useState<VerificationRecord[]>([]);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileTab, setMobileTab] = useState<"work" | "history">("work");
  const [deckOpen, setDeckOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("verifai-theme") || window.localStorage.getItem("strata-theme");
    const initial = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const applyTheme = (next: "dark" | "light") => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("verifai-theme", next);
  };

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/verifications", { cache: "no-store" });
      const data = (await res.json()) as { items?: VerificationRecord[] };
      setHistory(data.items ?? []);
    } catch {
      // keep existing
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void fetch("/api/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => setConfig(c))
      .catch(() => undefined);
  }, [loadHistory]);

  const onFile = (next: File | null) => {
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setFile(next);
    const url = URL.createObjectURL(next);
    setPreview(url);
  };

  const resetComposer = () => {
    setResult(null);
    setBusy(false);
    setStatuses(idleStatuses());
    setDetails({});
    setError(null);
    setMobileTab("work");
  };

  const verify = async () => {
    if (claim.trim().length < 8) {
      setError("Enter a claim of at least 8 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    setResult(null);
    setStatuses(idleStatuses());
    setMobileTab("work");

    try {
      const form = new FormData();
      form.set("claim", claim.trim());
      if (file) {
        const compressed = await compressImage(file);
        form.set("image", compressed, "frame.jpg");
      }

      const res = await fetch("/api/verify", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        throw new Error("Verification request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.replace(/^data:\s?/, "");
          if (!payload.trim()) continue;
          const event = JSON.parse(payload) as VerifyEvent;
          if (event.type === "stage") {
            setStatuses((prev) => ({ ...prev, [event.id]: event.status }));
            if (event.detail) {
              setDetails((prev) => ({ ...prev, [event.id]: event.detail }));
            }
          } else if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "result") {
            setResult(event.verification);
            setHistory((prev) => [event.verification, ...prev.filter((h) => h.id !== event.verification.id)]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setStatuses((prev) => {
        const next = { ...prev };
        for (const id of STAGE_IDS) {
          if (next[id] === "running") next[id] = "error";
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/verifications/${id}`, { method: "DELETE" });
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (result?.id === id) setResult(null);
  };

  const retrievalLabel = useMemo(() => {
    if (!config) return "Checking retrieval…";
    if (config.searchConfigured) return `Search API · ${config.searchProvider}`;
    if (config.wikipediaEnabled) return "Wikipedia + news feeds · local fallback";
    return "Local demonstration corpus";
  }, [config]);

  return (
    <div className="app-shell">
      <div className="app-grain" />
      <header className="masthead relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div className="flex items-center gap-3">
          <img src="/brand/mark.png" alt="VERIFAI mark" className="h-11 w-11 rounded-[4px] object-cover hairline" />
          <div>
            <p className="kicker m-0">Copy desk · multimodal ledger</p>
            <h1 className="display m-0 text-2xl leading-none tracking-tight sm:text-3xl">
              VERIF<span className="ink-slash">AI</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setDeckOpen(true)}>
            Project briefing
          </button>
          <span className="hidden rounded-sm border border-[var(--line)] px-3 py-1 text-[11px] text-[var(--muted)] sm:inline">
            {retrievalLabel}
          </span>
          <span className="rounded-sm border border-[var(--line)] px-3 py-1 text-[11px] text-[var(--muted)]">
            {config?.modelConfigured ? "Model API configured" : "Local scoring"}
          </span>
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-xs"
            onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>
      {deckOpen ? <ProjectBriefing onClose={() => setDeckOpen(false)} /> : null}

      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-5 pb-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <p className="mb-4 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
            Paste a claim, attach a picture if you have one, and run the ledger. Open{" "}
            <button type="button" className="inline-link" onClick={() => setDeckOpen(true)}>
              the project briefing
            </button>{" "}
            for the viva-style walkthrough. Source cards now include a real Open button — not Wikipedia-only chips.
          </p>

          <div className="mb-4 flex gap-2 lg:hidden">
            <button
              type="button"
              className={`btn px-4 py-2 text-xs ${mobileTab === "work" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMobileTab("work")}
            >
              Workspace
            </button>
            <button
              type="button"
              className={`btn px-4 py-2 text-xs ${mobileTab === "history" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMobileTab("history")}
            >
              History ({history.length})
            </button>
          </div>

          <div className={mobileTab === "history" ? "hidden lg:block" : ""}>
            {!result && !busy ? (
              <Composer
                claim={claim}
                setClaim={setClaim}
                preview={preview}
                onFile={onFile}
                onClearImage={() => onFile(null)}
                onVerify={() => void verify()}
                busy={busy}
                error={error}
              />
            ) : null}

            {busy ? (
              <div className="card p-6 sm:p-8">
                <p className="kicker m-0">Running pipeline</p>
                <h2 className="display m-0 mt-2 text-3xl">Reading the claim, the frame, then the record.</h2>
                {preview ? (
                  <img src={preview} alt="" className="mt-5 h-36 w-full rounded-2xl object-cover" />
                ) : null}
                <p className="mt-4 text-sm italic text-[var(--muted)]">“{claim}”</p>
                <div className="mt-6">
                  <StageTimeline statuses={statuses} details={details} />
                </div>
                {error ? <p className="mt-4 text-sm text-[var(--false)]">{error}</p> : null}
              </div>
            ) : null}

            {result && !busy ? <Report record={result} onNew={resetComposer} /> : null}
          </div>

          <div className={`lg:hidden ${mobileTab === "history" ? "block" : "hidden"}`}>
            <div className="card p-4">
              <p className="kicker m-0 mb-3">History</p>
              <HistoryRail
                items={history}
                activeId={result?.id ?? null}
                onSelect={(item) => {
                  setResult(item);
                  setBusy(false);
                  setMobileTab("work");
                }}
                onDelete={(id) => void deleteItem(id)}
              />
            </div>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-5 card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="kicker m-0">History</p>
              <span className="mono text-[11px] text-[var(--faint)]">{history.length}</span>
            </div>
            <div className="scroll-thin max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
              <HistoryRail
                items={history}
                activeId={result?.id ?? null}
                onSelect={(item) => {
                  setResult(item);
                  setBusy(false);
                }}
                onDelete={(id) => void deleteItem(id)}
              />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.84),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
