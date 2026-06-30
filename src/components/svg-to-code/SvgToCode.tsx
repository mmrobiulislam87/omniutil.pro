"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import { downloadBlob, formatBytes } from "@/lib/format";
import {
  transformSvg,
  type OutputFormat,
  type SvgTransformResult,
} from "@/utils/svgTransformer";

const FORMAT_TABS: { id: OutputFormat; label: string; hint: string }[] = [
  { id: "react", label: "React", hint: "TSX component with SVGProps" },
  { id: "tailwind", label: "Tailwind", hint: "currentColor + w-6 h-6" },
  { id: "svg", label: "Optimized SVG", hint: "SVGO-minified markup" },
];

export function SvgToCode() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SvgTransformResult | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>("react");
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("icon.svg");

  const outputCode = useMemo(() => {
    if (!result) return "";
    if (format === "svg") return result.optimizedSvg;
    if (format === "tailwind") return result.tailwindCode;
    return result.reactCode;
  }, [format, result]);

  const processSvg = useCallback(async (text: string, name: string) => {
    setProcessing(true);
    setError(null);
    setCopied(false);
    setFileName(name);

    try {
      const transformed = await transformSvg(text, name);
      setResult(transformed);
      setPreviewSvg(transformed.optimizedSvg);
    } catch (err) {
      setResult(null);
      setPreviewSvg(null);
      setError(err instanceof Error ? err.message : "SVG processing failed.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const text = await file.text();
      await processSvg(text, file.name);
    },
    [processSvg],
  );

  const handleCopy = useCallback(async () => {
    if (!outputCode) return;
    await navigator.clipboard.writeText(outputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [outputCode]);

  const handleDownload = useCallback(() => {
    if (!outputCode) return;
    const ext = format === "svg" ? "svg" : "tsx";
    const base = fileName.replace(/\.svg$/i, "") || "icon";
    downloadBlob(
      new Blob([outputCode], { type: "text/plain;charset=utf-8" }),
      `${base}.${ext}`,
    );
  }, [fileName, format, outputCode]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-violet-300">
          <Sparkles className="h-4 w-4" />
          SVGO engine · React & Tailwind codegen
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Drop an SVG icon or illustration. We optimize it with SVGO in your
          browser, then generate copy-paste React TSX or Tailwind-ready
          components — nothing uploads to a server.
        </p>
      </div>

      {!result && (
        <FileDropzone
          accept="image/svg+xml,.svg"
          disabled={processing}
          onFiles={handleFiles}
          label="Drop SVG here or click to browse"
          hint="SVG only · optimized locally with SVGO"
        />
      )}

      {error && <ToolErrorBanner message={error} />}

      {processing && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 py-16 text-sm text-gray-400">
          <Sparkles className="h-5 w-5 animate-pulse text-violet-400" />
          Optimizing SVG and generating code…
        </div>
      )}

      {result && previewSvg && !processing && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                Original:{" "}
                <span className="text-gray-300">
                  {formatBytes(result.originalBytes)}
                </span>
              </span>
              <span>
                Optimized:{" "}
                <span className="text-emerald-400">
                  {formatBytes(result.optimizedBytes)}
                </span>
              </span>
              <span>
                Saved:{" "}
                <span className="text-violet-400">
                  {result.savingsPercent}%
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setResult(null);
                setPreviewSvg(null);
                setError(null);
              }}
            >
              New SVG
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Live preview
              </p>
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-gray-800 bg-[#0B0F19] p-8 transition-all duration-500">
                <div
                  className="max-h-56 max-w-full transition-all duration-500 [&_svg]:h-auto [&_svg]:max-h-56 [&_svg]:w-full [&_svg]:max-w-xs"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Generated code
                </p>
                <div className="flex gap-1">
                  {FORMAT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      title={tab.hint}
                      onClick={() => setFormat(tab.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                        format === tab.id
                          ? "bg-violet-500/15 text-violet-300"
                          : "text-gray-500 hover:text-gray-300",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0B0F19]">
                <pre className="max-h-72 overflow-auto p-4 text-xs leading-relaxed text-emerald-400/90">
                  <code>{outputCode}</code>
                </pre>
                <div className="absolute right-2 top-2 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
