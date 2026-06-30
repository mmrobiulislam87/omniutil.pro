"use client";

import { useCallback, useMemo, useState } from "react";
import { Regex } from "lucide-react";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import {
  highlightMatches,
  testRegex,
  type RegexFlag,
} from "@/utils/regexBuilder";

const FLAG_OPTIONS: { flag: RegexFlag; label: string; hint: string }[] = [
  { flag: "g", label: "g", hint: "Global — all matches" },
  { flag: "i", label: "i", hint: "Case insensitive" },
  { flag: "m", label: "m", hint: "Multiline ^ $" },
  { flag: "s", label: "s", hint: "Dot matches newline" },
  { flag: "u", label: "u", hint: "Unicode" },
];

const PRESETS = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "URL", pattern: "https?:\\/\\/[\\w\\-._~:/?#[\\]@!$&'()*+,;=%]+" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { label: "Phone", pattern: "\\+?[0-9]{10,14}" },
  { label: "Date ISO", pattern: "\\d{4}-\\d{2}-\\d{2}" },
];

export function RegexBuilder() {
  const [pattern, setPattern] = useState("");
  const [testString, setTestString] = useState(
    "Contact us at hello@omniutil.pro or visit https://www.omniutil.pro",
  );
  const [flags, setFlags] = useState<RegexFlag[]>(["g"]);

  const result = useMemo(
    () => testRegex(pattern, testString, flags),
    [pattern, testString, flags],
  );

  const segments = useMemo(
    () => highlightMatches(testString, result.matches),
    [result.matches, testString],
  );

  const toggleFlag = useCallback((flag: RegexFlag) => {
    setFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-cyan-300">
          <Regex className="h-4 w-4" />
          Pure JavaScript · live match highlighting
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Build and test regular expressions with instant visual feedback.
          Capture groups and match positions update as you type — 100%
          client-side.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setPattern(preset.pattern)}
            className="rounded-lg border border-gray-800 bg-[#0B0F19] px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Regular expression
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-[#0B0F19] px-3 py-2 font-mono text-sm">
          <span className="text-gray-600">/</span>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="your pattern here"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-cyan-300 focus:outline-none"
          />
          <span className="text-gray-600">/</span>
          <span className="text-amber-300">{flags.join("")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FLAG_OPTIONS.map((opt) => (
            <button
              key={opt.flag}
              type="button"
              title={opt.hint}
              onClick={() => toggleFlag(opt.flag)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs transition",
                flags.includes(opt.flag)
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                  : "border-gray-800 text-gray-500 hover:text-gray-300",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!result.valid && result.error && (
        <ToolErrorBanner title="Regex error" message={result.error} />
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Test string
        </label>
        <textarea
          value={testString}
          onChange={(e) => setTestString(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full resize-y rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-sm text-gray-200 focus:border-cyan-500/50 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Highlighted matches ({result.matchCount})
        </p>
        <div className="min-h-20 rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap break-all">
          {segments.map((seg) =>
            seg.match ? (
              <mark
                key={seg.key}
                className="rounded bg-cyan-500/25 px-0.5 text-cyan-200"
              >
                {seg.match}
              </mark>
            ) : (
              <span key={seg.key}>{seg.before}</span>
            ),
          )}
        </div>
      </div>

      {result.matchCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Match details
          </p>
          <div className="space-y-2">
            {result.matches.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-800 bg-[#0B0F19]/60 px-3 py-2 text-xs font-mono text-gray-400"
              >
                <span className="text-gray-500">#{i + 1}</span> index{" "}
                <span className="text-cyan-300">{m.index}</span>–
                <span className="text-cyan-300">{m.end}</span>
                {m.groups.length > 0 && (
                  <span className="ml-2 text-violet-300">
                    groups: [{m.groups.map((g) => g ?? "").join(", ")}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
