"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Loader2, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import {
  ensureTacDatabase,
  getDeviceSpecRows,
  getTacDatabaseSize,
  lookupImei,
  type ImeiLookupResult,
} from "@/utils/imeiChecker";

function ResultCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0B0F19]/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={cn("mt-1 text-sm text-gray-200", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}

export function ImeiChecker() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ImeiLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbSize, setDbSize] = useState(0);
  const [dbStatus, setDbStatus] = useState("Loading device database…");
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    ensureTacDatabase(setDbStatus)
      .then((size) => {
        setDbSize(size);
        setDbReady(true);
      })
      .catch((err) => {
        setDbError(
          err instanceof Error ? err.message : "Database load failed.",
        );
      });
  }, []);

  const runLookup = useCallback(async (value: string) => {
    setInput(value);
    setImageError(false);

    if (!value.trim()) {
      setError(null);
      setResult(null);
      return;
    }

    setLookingUp(true);
    try {
      const lookup = await lookupImei(value);
      if ("error" in lookup) {
        setError(lookup.error);
        setResult(null);
      } else {
        setError(null);
        setResult(lookup);
        setDbSize(lookup.databaseSize);
      }
    } finally {
      setLookingUp(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void runLookup(input);
    },
    [input, runLookup],
  );

  const specRows = result?.device ? getDeviceSpecRows(result.device) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-emerald-300">
          100% private · IMEI never leaves your browser
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Dial <span className="font-mono text-gray-300">*#06#</span> on your
          phone to find the IMEI. We match the TAC (first 8 digits) against{" "}
          {dbReady
            ? `${dbSize.toLocaleString()}+ device models`
            : "a local GSMA TAC database"}{" "}
          with photos and specs — processed entirely on your device.
        </p>
      </div>

      {!dbReady && !dbError && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 text-sm text-gray-400">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-400" />
          {dbStatus}
        </div>
      )}

      {dbError && <ToolErrorBanner title="Database error" message={dbError} />}

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
            disabled={!dbReady || lookingUp}
            value={input}
            onChange={(e) => void runLookup(e.target.value)}
            placeholder="e.g. 862563068561913"
            className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-[#0B0F19] px-4 py-3 font-mono text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
          />
          <Button type="submit" className="shrink-0" disabled={!dbReady || lookingUp}>
            {lookingUp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Check IMEI
          </Button>
        </div>
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
                result.luhnValid
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400",
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
            <div className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-[#0B0F19]">
              <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[220px_1fr]">
                <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-white/5 p-4">
                  {result.device.imageUrl && !imageError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.device.imageUrl}
                      alt={result.device.name}
                      className="max-h-56 w-auto object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-48 w-full flex-col items-center justify-center text-center">
                      <Smartphone className="mb-2 h-12 w-12 text-gray-600" />
                      <p className="text-xs text-gray-500">No image available</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      Device identified
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-white">
                      {result.device.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {result.device.brand} · {result.device.model}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {specRows.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-lg border border-gray-800/80 bg-[#0B0F19]/40 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {row.label}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-200">
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.device.gsmarena && (
                    <a
                      href={result.device.gsmarena}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Full specifications on GSMArena
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300">
                No model match in database
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                TAC <span className="font-mono text-gray-300">{result.tac}</span>{" "}
                was not found in our {dbSize.toLocaleString()}-entry TAC index.
                Newer or regional models may not be listed yet.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultCard label="TAC" value={result.tac} mono />
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
              value={
                result.luhnValid
                  ? "Valid 15-digit IMEI"
                  : "15 digits, checksum failed"
              }
            />
          </div>
        </div>
      )}

      <p className="border-t border-gray-800 pt-4 text-[11px] leading-relaxed text-gray-600">
        TAC data includes Osmocom community database (CC-BY-SA) and curated
        supplements. Device images may load from GSMArena CDN when available.
        Blacklist / carrier-lock status is not available in client-only mode.
      </p>
    </div>
  );
}
