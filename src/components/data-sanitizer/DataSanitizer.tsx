"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { downloadText, formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  cleanData,
  getColumnNames,
  guessEmailColumn,
  guessPhoneColumn,
  parseCSVFile,
  rowsToCSV,
  type CleanResult,
} from "@/utils/dataCleaner";

const PREVIEW_ROWS = 8;

export function DataSanitizer() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [validateEmails, setValidateEmails] = useState(false);
  const [validatePhones, setValidatePhones] = useState(false);
  const [emailColumn, setEmailColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");

  const columns = useMemo(() => getColumnNames(rawRows), [rawRows]);
  const previewRows = (result?.rows ?? rawRows).slice(0, PREVIEW_ROWS);
  const previewColumns = columns.slice(0, 6);

  const handleFile = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    setFileSize(file.size);
    setParseProgress(0);

    try {
      const rows = await parseCSVFile(file, (p) => setParseProgress(p.parsed));
      if (rows.length === 0) {
        throw new Error("No data rows found in this file.");
      }

      const cols = getColumnNames(rows);
      setRawRows(rows);
      setEmailColumn(guessEmailColumn(cols) ?? cols[0] ?? "");
      setPhoneColumn(guessPhoneColumn(cols) ?? cols[0] ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
      setRawRows([]);
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const runClean = useCallback(() => {
    if (rawRows.length === 0) return;
    const cleaned = cleanData(rawRows, {
      removeDuplicates,
      validateEmails,
      validatePhones,
      emailColumn: validateEmails ? emailColumn : undefined,
      phoneColumn: validatePhones ? phoneColumn : undefined,
    });
    setResult(cleaned);
  }, [
    rawRows,
    removeDuplicates,
    validateEmails,
    validatePhones,
    emailColumn,
    phoneColumn,
  ]);

  const handleDownload = useCallback(() => {
    if (!result || result.rows.length === 0) return;
    const csv = rowsToCSV(result.rows);
    const base = fileName?.replace(/\.[^.]+$/, "") ?? "cleaned-data";
    downloadText(csv, `${base}-sanitized.csv`);
  }, [result, fileName]);

  return (
    <div className="space-y-6">
      {!rawRows.length && !parsing && (
        <FileDropzone
          accept=".csv,text/csv"
          onFiles={handleFile}
          label="Drop a CSV file here or click to browse"
          hint="Large files supported via chunked in-browser parsing"
        />
      )}

      {parsing && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm font-medium text-gray-300">Parsing CSV…</p>
          {parseProgress > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {parseProgress.toLocaleString()} rows loaded
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {rawRows.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 px-5 py-4">
            <div>
              <p className="font-medium text-gray-100">{fileName}</p>
              <p className="text-sm text-gray-500">
                {rawRows.length.toLocaleString()} rows · {formatBytes(fileSize)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRawRows([]);
                setResult(null);
                setFileName(null);
                setError(null);
              }}
            >
              Upload different file
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Cleaning options
              </h2>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(e) => setRemoveDuplicates(e.target.checked)}
                  className="mt-1 accent-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-100">
                    Remove duplicate rows
                  </p>
                  <p className="text-xs text-gray-500">
                    Uses Set-based deduplication across all columns
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={validateEmails}
                  onChange={(e) => setValidateEmails(e.target.checked)}
                  className="mt-1 accent-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-100">
                    Validate email addresses
                  </p>
                  <p className="text-xs text-gray-500">
                    Remove rows with invalid emails in selected column
                  </p>
                  {validateEmails && columns.length > 0 && (
                    <select
                      value={emailColumn}
                      onChange={(e) => setEmailColumn(e.target.value)}
                      className="mt-2 flex h-9 w-full rounded-lg border border-gray-700 bg-[#0B0F19] px-2 text-sm text-gray-100"
                    >
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={validatePhones}
                  onChange={(e) => setValidatePhones(e.target.checked)}
                  className="mt-1 accent-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-100">
                    Validate phone numbers
                  </p>
                  <p className="text-xs text-gray-500">
                    Remove rows with invalid phone numbers
                  </p>
                  {validatePhones && columns.length > 0 && (
                    <select
                      value={phoneColumn}
                      onChange={(e) => setPhoneColumn(e.target.value)}
                      className="mt-2 flex h-9 w-full rounded-lg border border-gray-700 bg-[#0B0F19] px-2 text-sm text-gray-100"
                    >
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <Button onClick={runClean} className="w-full">
                <Sparkles className="h-4 w-4" />
                Clean data
              </Button>
            </section>

            <section className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Results
              </h2>

              {result ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Original rows" value={result.originalRows} />
                    <Stat label="Clean rows" value={result.totalRows} highlight />
                    <Stat label="Duplicates removed" value={result.removedDuplicates} />
                    <Stat label="Invalid emails" value={result.invalidEmails} />
                    <Stat label="Invalid phones" value={result.invalidPhones} />
                  </div>
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4" />
                    Download cleaned CSV
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Configure options and click &ldquo;Clean data&rdquo; to see
                  stats and export.
                </p>
              )}
            </section>
          </div>

          {previewRows.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-gray-800">
              <div className="border-b border-gray-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-100">
                  Preview
                  <span className="ml-2 font-normal text-gray-500">
                    (first {PREVIEW_ROWS} rows)
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0B0F19]">
                      {previewColumns.map((col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-400"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-800/80"
                      >
                        {previewColumns.map((col) => (
                          <td
                            key={col}
                            className="max-w-[200px] truncate whitespace-nowrap px-4 py-2 text-gray-300"
                          >
                            {row[col] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        highlight
          ? "border-blue-500/30 bg-blue-500/10"
          : "border-gray-800",
      )}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold",
          highlight ? "text-blue-400" : "text-gray-100",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
