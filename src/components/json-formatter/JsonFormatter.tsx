"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import {
  formatJson,
  type JsonIndent,
} from "@/utils/jsonFormatter";

const INDENT_OPTIONS: { value: JsonIndent; label: string }[] = [
  { value: 2, label: "2 spaces" },
  { value: 4, label: "4 spaces" },
  { value: "minify", label: "Minified" },
];

export function JsonFormatter() {
  const [inputJson, setInputJson] = useState("");
  const [outputJson, setOutputJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [copied, setCopied] = useState(false);

  const runFormat = useCallback((raw: string, space: JsonIndent) => {
    const result = formatJson(raw, space);
    if (result.ok) {
      setOutputJson(result.output);
      setError(null);
    } else {
      setOutputJson("");
      setError(result.error);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputJson(value);
      runFormat(value, indent);
    },
    [indent, runFormat],
  );

  const handleIndentChange = useCallback(
    (value: JsonIndent) => {
      setIndent(value);
      runFormat(inputJson, value);
    },
    [inputJson, runFormat],
  );

  const clearAll = useCallback(() => {
    setInputJson("");
    setOutputJson("");
    setError(null);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!outputJson) return;
    try {
      await navigator.clipboard.writeText(outputJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Check browser permissions.");
    }
  }, [outputJson]);

  const waiting = !inputJson.trim() && !outputJson && !error;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-blue-300">Pure JavaScript · zero dependencies</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Validate, beautify, and minify JSON entirely in your browser. Syntax
          errors include line and column hints — nothing is sent to a server.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#1F2937]/30 p-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="json-indent"
            className="text-xs font-medium text-gray-400"
          >
            Tab size
          </label>
          <select
            id="json-indent"
            value={indent}
            onChange={(e) => {
              const val = e.target.value;
              handleIndentChange(
                val === "minify" ? "minify" : (Number(val) as 2 | 4),
              );
            }}
            className="rounded-lg border border-gray-700 bg-[#111827] px-2 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
          >
            {INDENT_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button size="sm" onClick={handleCopy} disabled={!outputJson}>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy output"}
          </Button>
        </div>
      </div>

      {error && <ToolErrorBanner title="JSON syntax error" message={error} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Raw JSON
          </span>
          <textarea
            value={inputJson}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder='Paste JSON here, e.g. {"name":"OmniUtil","private":true}'
            spellCheck={false}
            className="h-96 w-full resize-none rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-sm text-gray-300 placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Formatted output
          </span>
          <div
            className={cn(
              "relative h-96 overflow-hidden rounded-xl border border-gray-800 bg-[#0B0F19]",
              waiting && "border-dashed",
            )}
          >
            {waiting ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
                Formatted JSON will appear here after you paste valid input.
              </div>
            ) : (
              <textarea
                readOnly
                value={outputJson}
                spellCheck={false}
                aria-label="Formatted JSON output"
                className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm text-emerald-400 focus:outline-none"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
