"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import type {
  Condition,
  ParsedCardLine,
  PriceFinish,
} from "./types";

type CsvMapping = {
  name: string;
  quantity: string;
  setCode: string;
  collectorNumber: string;
  condition: string;
  finish: string;
};

const EMPTY_MAPPING: CsvMapping = {
  name: "",
  quantity: "",
  setCode: "",
  collectorNumber: "",
  condition: "",
  finish: "",
};

export function CsvImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ParsedCardLine[], filename: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>(EMPTY_MAPPING);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");

  const mappedPreview = useMemo(
    () => records.slice(0, 5).map((record) => mapRecord(record, mapping)),
    [records, mapping],
  );

  if (!open) return null;

  async function loadFile(file?: File) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file.");
      return;
    }

    setError("");
    setFilename(file.name);

    try {
      const contents = await file.text();
      const parsed = parseCsv(contents);

      if (parsed.length < 2) {
        throw new Error("The CSV does not contain any collection rows.");
      }

      const nextHeaders = parsed[0].map((value) => value.trim());
      const nextRecords = parsed
        .slice(1)
        .filter((row) => row.some((value) => value.trim()))
        .map((row) =>
          Object.fromEntries(
            nextHeaders.map((header, index) => [header, row[index] ?? ""]),
          ),
        );

      setHeaders(nextHeaders);
      setRecords(nextRecords);
      setMapping(detectMapping(nextHeaders));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The CSV could not be read.",
      );
    }
  }

  async function importRows() {
    if (!mapping.name) {
      setError("Select the card-name column before importing.");
      return;
    }

    const rows = records
      .map((record) => mapRecord(record, mapping))
      .filter((row) => row.name.trim());

    if (!rows.length) {
      setError("No valid card rows were found.");
      return;
    }

    setIsImporting(true);
    setError("");

    try {
      await onImport(rows, filename || "collection.csv");
      onClose();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The collection could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close CSV importer"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-[940px] overflow-y-auto rounded-[28px] border border-td-accent/[0.14] bg-td-surface/98 p-5 shadow-[0_38px_120px_rgb(var(--td-shadow-rgb)/calc(0.62*var(--td-shadow-strength)))] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">
              Large Collection Import
            </p>
            <h2 className="mt-2 text-xl font-semibold text-td-primary">
              Import collection CSV
            </h2>
            <p className="mt-2 text-[11px] leading-4 text-td-muted">
              Supports generic CSV files and common exports from TCGplayer,
              ManaBox, Dragon Shield, Delver Lens, and similar collection apps.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => loadFile(event.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            loadFile(event.dataTransfer.files?.[0]);
          }}
          className={[
            "mt-6 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 transition",
            isDragging
              ? "border-td-accent/40 bg-td-accent/[0.06]"
              : "border-td-ink/[0.09] bg-black/[0.09] hover:border-td-accent/[0.2]",
          ].join(" ")}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-td-accent/[0.12] bg-td-accent/[0.04] text-td-accent-text">
            <Upload className="h-5 w-5" />
          </span>
          <p className="mt-4 text-xs font-semibold text-td-secondary">
            {filename || "Drop a CSV here or choose a file"}
          </p>
          <p className="mt-1 text-[11px] text-td-muted">
            Hundreds or thousands of card rows can be imported.
          </p>
        </button>

        {headers.length ? (
          <>
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-td-violet">
                Column mapping
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MappingSelect
                  label="Card name"
                  required
                  headers={headers}
                  value={mapping.name}
                  onChange={(name) =>
                    setMapping((current) => ({ ...current, name }))
                  }
                />
                <MappingSelect
                  label="Quantity"
                  headers={headers}
                  value={mapping.quantity}
                  onChange={(quantity) =>
                    setMapping((current) => ({ ...current, quantity }))
                  }
                />
                <MappingSelect
                  label="Set code"
                  headers={headers}
                  value={mapping.setCode}
                  onChange={(setCode) =>
                    setMapping((current) => ({ ...current, setCode }))
                  }
                />
                <MappingSelect
                  label="Collector number"
                  headers={headers}
                  value={mapping.collectorNumber}
                  onChange={(collectorNumber) =>
                    setMapping((current) => ({
                      ...current,
                      collectorNumber,
                    }))
                  }
                />
                <MappingSelect
                  label="Condition"
                  headers={headers}
                  value={mapping.condition}
                  onChange={(condition) =>
                    setMapping((current) => ({ ...current, condition }))
                  }
                />
                <MappingSelect
                  label="Finish / foil"
                  headers={headers}
                  value={mapping.finish}
                  onChange={(finish) =>
                    setMapping((current) => ({ ...current, finish }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-td-ink/[0.06]">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-td-ink/[0.06] text-[11px] uppercase tracking-[0.12em] text-td-muted">
                    <th className="px-3 py-3">Card</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3">Set</th>
                    <th className="px-3 py-3">Collector</th>
                    <th className="px-3 py-3">Condition</th>
                    <th className="px-3 py-3">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, index) => (
                    <tr
                      key={`${row.name}-${index}`}
                      className="border-b border-td-ink/[0.045] text-[11px] text-td-muted"
                    >
                      <td className="px-3 py-3 font-semibold text-td-secondary">
                        {row.name || "—"}
                      </td>
                      <td className="px-3 py-3">{row.quantity}</td>
                      <td className="px-3 py-3">
                        {row.setCode?.toUpperCase() || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {row.collectorNumber || "—"}
                      </td>
                      <td className="px-3 py-3">{row.condition}</td>
                      <td className="px-3 py-3">{row.finish}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-td-muted">
              <span>{records.length.toLocaleString("en-US")} CSV rows detected</span>
              <span>Showing the first {Math.min(5, records.length)}</span>
            </div>
          </>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-td-danger/[0.13] bg-td-danger/[0.04] px-4 py-3 text-[11px] text-td-danger">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!records.length || !mapping.name || isImporting}
          onClick={importRows}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-td-accent via-td-accent to-td-accent text-[11px] font-semibold text-td-on-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          {isImporting
            ? "Importing and pricing..."
            : `Import ${records.length.toLocaleString("en-US")} cards`}
        </button>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-td-accent/[0.09] bg-td-accent/[0.025] px-3 py-3 text-[11px] leading-4 text-td-muted">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-td-success" />
          Exact set and collector-number columns provide the strongest printing
          match. Staff can still change any row using the printing dropdown
          after import.
        </div>
      </div>
    </div>
  );
}

function MappingSelect({
  label,
  headers,
  value,
  onChange,
  required = false,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
        {label}
        {required ? <span className="ml-1 text-td-accent-text">*</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-td-ink/[0.065] bg-td-surface px-3 text-[11px] text-td-secondary outline-none"
      >
        <option value="">Not included</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}

function detectMapping(headers: string[]): CsvMapping {
  return {
    name: findHeader(headers, [
      "card name",
      "name",
      "product name",
      "card",
      "product",
    ]),
    quantity: findHeader(headers, ["quantity", "qty", "count", "amount"]),
    setCode: findHeader(headers, [
      "set code",
      "set",
      "edition code",
      "expansion",
      "setcode",
    ]),
    collectorNumber: findHeader(headers, [
      "collector number",
      "collector #",
      "number",
      "card number",
      "cn",
    ]),
    condition: findHeader(headers, [
      "condition",
      "printing condition",
      "card condition",
    ]),
    finish: findHeader(headers, [
      "finish",
      "foil",
      "printing",
      "is foil",
      "foil status",
    ]),
  };
}

function findHeader(headers: string[], candidates: string[]) {
  const normalized = headers.map((header) => header.trim().toLowerCase());

  for (const candidate of candidates) {
    const exactIndex = normalized.indexOf(candidate);
    if (exactIndex >= 0) return headers[exactIndex];
  }

  for (const candidate of candidates) {
    const partialIndex = normalized.findIndex((header) =>
      header.includes(candidate),
    );
    if (partialIndex >= 0) return headers[partialIndex];
  }

  return "";
}

function mapRecord(
  record: Record<string, string>,
  mapping: CsvMapping,
): ParsedCardLine {
  const name = value(record, mapping.name).trim();
  const quantity = Math.max(
    1,
    Number.parseInt(value(record, mapping.quantity), 10) || 1,
  );
  const setCode = value(record, mapping.setCode).trim().toLowerCase() || undefined;
  const collectorNumber =
    value(record, mapping.collectorNumber).trim() || undefined;
  const condition = normalizeCondition(value(record, mapping.condition));
  const finish = normalizeFinish(value(record, mapping.finish));

  return {
    raw: [
      quantity,
      name,
      setCode ? `[${setCode.toUpperCase()}${collectorNumber ? ` #${collectorNumber}` : ""}]` : "",
      finish !== "nonfoil" ? finish.toUpperCase() : "",
      condition,
    ]
      .filter(Boolean)
      .join(" "),
    quantity,
    name,
    setCode,
    collectorNumber,
    condition,
    finish,
  };
}

function value(record: Record<string, string>, header: string) {
  return header ? record[header] ?? "" : "";
}

function normalizeCondition(input: string): Condition {
  const normalized = input.trim().toUpperCase().replaceAll("-", " ");

  if (
    normalized === "LP" ||
    normalized.includes("LIGHTLY") ||
    normalized.includes("EXCELLENT")
  ) {
    return "LP";
  }

  if (
    normalized === "MP" ||
    normalized.includes("MODERATELY") ||
    normalized.includes("GOOD")
  ) {
    return "MP";
  }

  if (
    normalized === "HP" ||
    normalized.includes("HEAVILY") ||
    normalized.includes("PLAYED")
  ) {
    return "HP";
  }

  if (
    normalized === "DMG" ||
    normalized.includes("DAMAGED") ||
    normalized.includes("POOR")
  ) {
    return "DMG";
  }

  return "NM";
}

function normalizeFinish(input: string): PriceFinish {
  const normalized = input.trim().toLowerCase();

  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1" ||
    normalized.includes("foil")
  ) {
    return normalized.includes("etched") ? "etched" : "foil";
  }

  if (normalized.includes("etched")) return "etched";
  return "nonfoil";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
