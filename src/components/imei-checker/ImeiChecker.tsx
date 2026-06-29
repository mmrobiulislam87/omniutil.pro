"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import {
  getTacDatabaseSize,
  loadExtendedTacDatabase,
  lookupImei,
  type ImeiLookupResult,
} from "@/utils/imeiChecker";

function ResultCard({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0B0F19]/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm",
          mono && "font-mono",
          highlight ? "font-semibold text-white" : "text-gray-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ImeiChecker() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ImeiLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbSize, setDbSize] = useState(getTacDatabaseSize());
  const [loadingDb, setLoadingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const runLookup = useCallback((value: string) => {
    setInput(value);
    const lookup = lookupImei(value);
    if ("error" in lookup) {
      setError(lookup.error);
      setResult(null);
      return;
    }
    setError(null);
    setResult(lookup);
    setDbSize(lookup.databaseSize);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      runLookup(input);
    },
    [input, runLookup],
  );

  const loadExtended = useCallback(async () => {
    setLoadingDb(true);
    setDbError(null);
    try {
      const size = await loadExtendedTacDatabase();
      setDbSize(size);
      if (input.trim()) runLookup(input);
    } catch (err) {
      setDbError(
        err instanceof Error
          ? err.message
          : "Could not load extended database.",
      );
    } finally {
      setLoadingDb(false);
    }
  }, [input, runLookup]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-emerald-300">
          100% private · IMEI never leaves your browser
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Dial <span className="font-mono text-gray-300">*#06#</span> on your
          phone to find the IMEI. We validate the checksum (Luhn) and match the
          TAC (first 8 digits) against a local device database — no server
          uploads.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label
          htmlFor="imei-input"
          className="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          IMEI number
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="imei-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => runLookup(e.target.value)}
            placeholder="e.g. 353325101234567"
            className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-[#0B0F19] px-4 py-3 font-mono text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
          />
          <Button type="submit" className="shrink-0">
            <Search className="h-4 w-4" />
            Check IMEI
          </Button>
        </div>
        <p className="text-xs text-gray-600">
          15 digits · local TAC database ({dbSize.toLocaleString()} models)
        </p>
      </form>

      {error && <ToolErrorBanner title="Invalid IMEI" message={error} />}

      {result && (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              result.luhnValid
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                result.luhnValid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400",
              )}
            >
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  result.luhnValid ? "text-emerald-300" : "text-amber-300",
                )}
              >
                {result.luhnValid
                  ? "Valid IMEI checksum"
                  : "Invalid checksum — double-check the digits"}
              </p>
              <p className="font-mono text-xs text-gray-500">{result.imei}</p>
            </div>
          </div>

          {result.device ? (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Device match
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {result.device.name ?? result.device.model}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {result.device.brand} · {result.device.model}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300">No model match in local database</p>
              <p className="mt-1 text-xs leading-relaxed">
                TAC <span className="font-mono text-gray-300">{result.tac}</span>{" "}
                was not found. Try loading the extended database below, or verify
                the IMEI from your device label / box.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultCard label="TAC" value={result.tac} mono highlight />
            <ResultCard label="Serial (SNR)" value={result.serialNumber} mono />
            <ResultCard label="Check digit" value={result.checkDigit} mono />
            <ResultCard label="Reporting body" value={result.reportingBody} />
            <ResultCard
              label="Allocation prefix"
              value={result.imei.slice(0, 2)}
              mono
            />
            <ResultCard
              label="Format"
              value={result.luhnValid ? "Valid 15-digit IMEI" : "15 digits, checksum failed"}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          Extended database adds more TAC entries (Osmocom format). Fetched once
          to your browser only.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadExtended}
          disabled={loadingDb}
        >
          {loadingDb ? "Loading…" : "Load extended TAC database"}
        </Button>
      </div>
      {dbError && (
        <p className="text-xs text-amber-400" role="status">
          {dbError}
        </p>
      )}
    </div>
  );
}
