"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, FileUp, Loader2, UploadCloud } from "lucide-react";

type CatalogStatus = {
  totalRecords: number;
  uniqueProducts: number;
  sets: number;
  lastImport: {
    status?: string;
    total_rows?: number;
    processed_rows?: number;
    inserted_rows?: number;
    updated_rows?: number;
    rejected_rows?: number;
    filename?: string | null;
    completed_at?: string | null;
    started_at?: string | null;
    error_summary?: unknown;
  } | null;
  defaultStorageImport?: {
    bucket: string;
    prefix: string;
    paths: string[];
  };
};

type ImportSummary = {
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  rejectedRows: number;
  errors: Array<{ row: number; error: string }>;
};

type ImportResponse = {
  ok?: boolean;
  action?: "validate" | "import" | "storage-list" | "storage-import";
  summary?: ImportSummary;
  result?: {
    status: "processing" | "completed" | "failed";
    skippedCompletedImport: boolean;
    parts: Array<{
      path: string;
      status: "pending" | "processing" | "completed" | "failed";
      totalRows: number;
      processedRows: number;
      insertedRows: number;
      updatedRows: number;
      rejectedRows: number;
      error?: string;
    }>;
    summary: ImportSummary;
  };
  paths?: string[];
  error?: string;
};

export function TcgplayerCatalogManager() {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState<"validate" | "import" | "storage-list" | "storage-import" | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageBucket, setStorageBucket] = useState("catalog-imports");
  const [storagePrefix, setStoragePrefix] = useState("tcgplayer/magic/2026-08-10/");
  const [storagePaths, setStoragePaths] = useState([
    "tcgplayer/magic/2026-08-10/part-001.csv",
    "tcgplayer/magic/2026-08-10/part-002.csv",
    "tcgplayer/magic/2026-08-10/part-003.csv",
  ]);

  useEffect(() => {
    void refreshStatus();
  }, []);

  const progress = useMemo(() => {
    const summary = result?.summary;
    if (!summary?.totalRows) return 0;
    return Math.round(((summary.processedRows + summary.rejectedRows) / summary.totalRows) * 100);
  }, [result]);

  async function refreshStatus() {
    const response = await fetch("/api/admin/tcgplayer-catalog");
    const payload = await response.json() as CatalogStatus & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not load catalog status.");
      return;
    }
    setStatus(payload);
    if (payload.defaultStorageImport) {
      setStorageBucket(payload.defaultStorageImport.bucket);
      setStoragePrefix(payload.defaultStorageImport.prefix);
      setStoragePaths(payload.defaultStorageImport.paths);
    }
  }

  async function run(action: "validate" | "import") {
    if (!file) {
      setError("Choose the TCGplayer Magic CSV first.");
      return;
    }

    setWorking(action);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("action", action);
    form.set("file", file);

    try {
      const response = await fetch("/api/admin/tcgplayer-catalog", {
        method: "POST",
        body: form,
      });
      const payload = await response.json() as ImportResponse;
      setResult(payload);
      if (!response.ok) setError(payload.error ?? "TCGplayer catalog import failed.");
      else await refreshStatus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "TCGplayer catalog import failed.");
    } finally {
      setWorking(null);
    }
  }

  async function runStorage(action: "storage-list" | "storage-import") {
    setWorking(action);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/tcgplayer-catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          bucket: storageBucket,
          prefix: storagePrefix,
          paths: storagePaths,
          retryFailed: true,
        }),
      });
      const payload = await response.json() as ImportResponse;
      setResult(payload);
      if (payload.paths) setStoragePaths(payload.paths);
      if (!response.ok) setError(payload.error ?? "TCGplayer storage catalog import failed.");
      else await refreshStatus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "TCGplayer storage catalog import failed.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#02070d] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(8,22,33,.96),rgba(3,9,15,.98))] p-5 shadow-[0_24px_90px_rgba(0,0,0,.28)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.14] bg-cyan-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                <Database className="h-3.5 w-3.5" />
                Catalog Management
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                TCGplayer Magic Catalog
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Canonical condition and finish-specific TCGplayer reference rows for matching, pricing, exports, scanner workflows, and seller operations. These records are not user inventory.
              </p>
            </div>

            <a
              href="/dashboard/admin"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/[0.16] hover:text-white"
            >
              Back to Command Center
            </a>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total catalog records" value={formatNumber(status?.totalRecords ?? 0)} />
            <Metric label="Unique products" value={formatNumber(status?.uniqueProducts ?? 0)} />
            <Metric label="Sets" value={formatNumber(status?.sets ?? 0)} />
            <Metric label="Last import" value={status?.lastImport?.status ?? "None"} />
          </div>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[24px] border border-white/[0.08] bg-[#06111b] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-200">
                <FileUp className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Upload canonical CSV</h2>
                <p className="mt-1 text-xs text-slate-500">Validate first, then import/update the catalog by TCGplayer ID.</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-300/[0.12] bg-cyan-300/[0.035] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-cyan-50">Supabase Storage import</h3>
                  <p className="mt-1 text-xs leading-5 text-cyan-100/55">
                    Treats the three uploaded CSV parts as one logical catalog import. Files stay in Supabase Storage and are streamed server-side.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-cyan-200/15 bg-black/15 px-2.5 py-1 text-[10px] font-bold text-cyan-100">
                  {formatNumber(799149)} expected rows
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/45">Bucket</span>
                  <input
                    value={storageBucket}
                    onChange={(event) => setStorageBucket(event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-300/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/45">Folder prefix</span>
                  <input
                    value={storagePrefix}
                    onChange={(event) => setStoragePrefix(event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-300/30"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/45">CSV objects, processed in order</span>
                <textarea
                  value={storagePaths.join("\n")}
                  onChange={(event) => setStoragePaths(event.target.value.split(/\r?\n/).map((path) => path.trim()).filter(Boolean))}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none focus:border-cyan-300/30"
                />
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => void runStorage("storage-list")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-black/15 px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {working === "storage-list" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify storage parts
                </button>
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => void runStorage("storage-import")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#001018] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {working === "storage-import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Import all parts
                </button>
              </div>
            </div>

            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-black/[0.14] p-6 text-center transition hover:border-cyan-300/[0.18] hover:bg-cyan-400/[0.025]">
              <UploadCloud className="h-8 w-8 text-cyan-300/70" />
              <span className="mt-3 text-sm font-semibold text-white">
                {file ? file.name : "Choose TCGplayer Magic CSV"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Expected columns must match the TCGplayer pricing export exactly.
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={!file || working !== null}
                onClick={() => void run("validate")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-cyan-400/[0.055] px-5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.09] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {working === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Validate file
              </button>
              <button
                type="button"
                disabled={!file || working !== null}
                onClick={() => void run("import")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-[#001018] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {working === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Import/update catalog
              </button>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-300/[0.18] bg-rose-400/[0.05] p-4 text-sm text-rose-100">
                <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[24px] border border-white/[0.08] bg-[#06111b] p-5">
            <h2 className="text-base font-semibold text-white">Import status</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Full exports refresh existing rows by TCGplayer ID instead of creating duplicates. Missing rows are not deleted automatically.
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 space-y-2 text-xs">
              <StatusLine label="Processing" value={working ? "Active" : result ? "Complete" : "Idle"} />
              <StatusLine label="Total rows" value={formatNumber(result?.summary?.totalRows ?? status?.lastImport?.total_rows ?? 0)} />
              <StatusLine label="Processed" value={formatNumber(result?.summary?.processedRows ?? status?.lastImport?.processed_rows ?? 0)} />
              <StatusLine label="Inserted" value={formatNumber(result?.summary?.insertedRows ?? status?.lastImport?.inserted_rows ?? 0)} />
              <StatusLine label="Updated" value={formatNumber(result?.summary?.updatedRows ?? status?.lastImport?.updated_rows ?? 0)} />
              <StatusLine label="Rejected" value={formatNumber(result?.summary?.rejectedRows ?? status?.lastImport?.rejected_rows ?? 0)} />
            </div>

            {result?.result?.parts?.length ? (
              <div className="mt-5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Storage parts</p>
                {result.result.parts.map((part) => (
                  <div key={part.path} className="rounded-xl border border-white/[0.055] bg-black/[0.1] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[11px] font-semibold text-slate-300">{part.path.split("/").pop()}</span>
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase text-slate-400">{part.status}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {formatNumber(part.processedRows)} processed / {formatNumber(part.rejectedRows)} rejected
                    </p>
                    {part.error ? <p className="mt-2 text-[10px] leading-4 text-rose-200">{part.error}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {result?.summary?.errors?.length ? (
              <div className="mt-5 rounded-2xl border border-amber-300/[0.14] bg-amber-300/[0.045] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">Validation errors</p>
                <ul className="mt-3 space-y-2 text-[11px] leading-4 text-amber-100/75">
                  {result.summary.errors.slice(0, 5).map((item) => (
                    <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.055] bg-black/[0.1] px-3 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
