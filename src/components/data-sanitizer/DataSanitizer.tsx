"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { downloadText, formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  cleanData,
  filterRowsByColumns,
  getColumnNames,
  guessEmailColumn,
  guessPhoneColumn,
  parseDataFile,
  rowsToCSV,
  type CleanResult,
  type DataFileKind,
} from "@/utils/dataCleaner";

const PREVIEW_ROWS = 8;
const ACCEPTED_FILES =
  ".csv,text/csv,.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function DataSanitizer() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<DataFileKind | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");

  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [validateEmails, setValidateEmails] = useState(false);
  const [validatePhones, setValidatePhones] = useState(false);
  const [emailColumn, setEmailColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [includedColumns, setIncludedColumns] = useState<string[]>([]);

  const columns = useMemo(() => getColumnNames(rawRows), [rawRows]);
  const activeColumns = useMemo(
    () =>
      includedColumns.length > 0
        ? includedColumns.filter((col) => columns.includes(col))
        : columns,
    [columns, includedColumns],
  );
  const previewRows = (result?.rows ?? filterRowsByColumns(rawRows, activeColumns))
    .slice(0, PREVIEW_ROWS);
  const previewColumns = activeColumns.slice(0, 6);

  const resetWorkspace = useCallback(() => {
    setSourceFile(null);
    setRawRows([]);
    setResult(null);
    setFileName(null);
    setFileKind(null);
    setFileSize(0);
    setSheetNames([]);
    setActiveSheet("");
    setIncludedColumns([]);
    setError(null);
    setEmailColumn("");
    setPhoneColumn("");
  }, []);

  const loadFile = useCallback(
    async (file: File, sheetName?: string) => {
      setParsing(true);
      setError(null);
      setResult(null);
      setParseProgress(0);

      try {
        const parsed = await parseDataFile(
          file,
          { sheetName },
          (progress) => setParseProgress(progress.parsed),
        );

        if (parsed.rows.length === 0) {
          throw new Error("No data rows found in this file.");
        }

        const cols = getColumnNames(parsed.rows);
        setSourceFile(file);
        setFileName(file.name);
        setFileKind(parsed.kind);
        setFileSize(file.size);
        setRawRows(parsed.rows);
        setSheetNames(parsed.sheetNames);
        setActiveSheet(parsed.activeSheet ?? "");
        setIncludedColumns(cols);
        setEmailColumn(guessEmailColumn(cols) ?? cols[0] ?? "");
        setPhoneColumn(guessPhoneColumn(cols) ?? cols[0] ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
        resetWorkspace();
      } finally {
        setParsing(false);
      }
    },
    [resetWorkspace],
  );

  const handleFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      await loadFile(file);
    },
    [loadFile],
  );

  const handleSheetChange = useCallback(
    async (sheetName: string) => {
      if (!sourceFile || sheetName === activeSheet) return;
      await loadFile(sourceFile, sheetName);
    },
    [activeSheet, loadFile, sourceFile],
  );

  useEffect(() => {
    if (validateEmails && emailColumn && !activeColumns.includes(emailColumn)) {
      setEmailColumn(activeColumns[0] ?? "");
    }
    if (validatePhones && phoneColumn && !activeColumns.includes(phoneColumn)) {
      setPhoneColumn(activeColumns[0] ?? "");
    }
  }, [activeColumns, emailColumn, phoneColumn, validateEmails, validatePhones]);

  const toggleColumn = useCallback((column: string) => {
    setIncludedColumns((prev) => {
      const base = prev.length > 0 ? prev : columns;
      if (base.includes(column)) {
        const next = base.filter((col) => col !== column);
        return next.length > 0 ? next : base;
      }
      return [...base, column];
    });
    setResult(null);
  }, [columns]);

  const selectAllColumns = useCallback(() => {
    setIncludedColumns(columns);
    setResult(null);
  }, [columns]);

  const runClean = useCallback(() => {
    if (rawRows.length === 0 || activeColumns.length === 0) return;

    const mappedRows = filterRowsByColumns(rawRows, activeColumns);
    const cleaned = cleanData(mappedRows, {
      removeDuplicates,
      validateEmails,
      validatePhones,
      emailColumn: validateEmails ? emailColumn : undefined,
      phoneColumn: validatePhones ? phoneColumn : undefined,
    });
    setResult(cleaned);
  }, [
    rawRows,
    activeColumns,
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

  const parsingLabel =
    fileKind === "excel"
      ? parseProgress > 0
        ? `Parsing Excel locally… (${parseProgress.toLocaleString()} rows)`
        : "Parsing Excel locally…"
      : parseProgress > 0
        ? `Parsing CSV locally… (${parseProgress.toLocaleString()} rows)`
        : "Parsing CSV locally…";

  return (
    <div className="space-y-6">
      {parsing ? (
        <ToolStateWrapper isLoading loadingMessage={parsingLabel} />
      ) : !rawRows.length ? (
        <div className="space-y-4">
          {error && <ToolStateWrapper error={error} />}
          <FileDropzone
            accept={ACCEPTED_FILES}
            onFiles={handleFile}
            label="Drop a CSV or Excel file here or click to browse"
            hint="CSV, XLSX, XLS — parsed entirely in your browser"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 px-5 py-4">
            <div>
              <p className="font-medium text-gray-100">{fileName}</p>
              <p className="text-sm text-gray-500">
                {rawRows.length.toLocaleString()} rows · {formatBytes(fileSize)}
                {fileKind === "excel" && activeSheet && (
                  <span className="ml-2 text-blue-400/80">· {activeSheet}</span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetWorkspace}>
              Upload different file
            </Button>
          </div>

          {fileKind === "excel" && sheetNames.length > 1 && (
            <section className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5">
              <Label htmlFor="sheet-select" className="mb-2 block">
                Worksheet
              </Label>
              <select
                id="sheet-select"
                value={activeSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                disabled={parsing}
                className="flex h-10 w-full max-w-md rounded-lg border border-gray-700 bg-[#0B0F19] px-3 text-sm text-gray-100"
              >
                {sheetNames.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                This workbook has {sheetNames.length} sheets. Switch to load a
                different worksheet.
              </p>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Column mapping
                </h2>
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Select all
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Choose which columns to include in cleaning and export.
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-800 p-3">
                {columns.map((col) => {
                  const checked = activeColumns.includes(col);
                  return (
                    <label
                      key={col}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(col)}
                        className="accent-blue-500"
                      />
                      <span className="truncate">{col}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600">
                {activeColumns.length}/{columns.length} columns selected
              </p>
            </section>

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
                    Uses Set-based deduplication across selected columns
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
                  {validateEmails && activeColumns.length > 0 && (
                    <select
                      value={emailColumn}
                      onChange={(e) => setEmailColumn(e.target.value)}
                      className="mt-2 flex h-9 w-full rounded-lg border border-gray-700 bg-[#0B0F19] px-2 text-sm text-gray-100"
                    >
                      {activeColumns.map((col) => (
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
                  {validatePhones && activeColumns.length > 0 && (
                    <select
                      value={phoneColumn}
                      onChange={(e) => setPhoneColumn(e.target.value)}
                      className="mt-2 flex h-9 w-full rounded-lg border border-gray-700 bg-[#0B0F19] px-2 text-sm text-gray-100"
                    >
                      {activeColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <Button
                onClick={runClean}
                className="w-full"
                disabled={activeColumns.length === 0}
              >
                <Sparkles className="h-4 w-4" />
                Clean data
              </Button>
            </section>
          </div>

          <section className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Results
            </h2>

            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Stat label="Original rows" value={result.originalRows} />
                  <Stat label="Clean rows" value={result.totalRows} highlight />
                  <Stat label="Duplicates removed" value={result.removedDuplicates} />
                  <Stat label="Invalid emails" value={result.invalidEmails} />
                  <Stat label="Invalid phones" value={result.invalidPhones} />
                </div>
                <Button onClick={handleDownload} className="w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  Download cleaned CSV
                </Button>
              </div>
            ) : (
              <ToolStateWrapper
                isEmpty
                emptyIcon="✨"
                emptyMessage='Configure columns and options, then click "Clean data".'
              />
            )}
          </section>

          {previewRows.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-gray-800">
              <div className="border-b border-gray-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-100">
                  Preview
                  <span className="ml-2 font-normal text-gray-500">
                    (first {PREVIEW_ROWS} rows
                    {result ? ", cleaned" : ""})
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
                      <tr key={i} className="border-b border-gray-800/80">
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
