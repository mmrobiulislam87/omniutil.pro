"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Sparkles,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner, ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { downloadBlob, formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  PDF_ACCEPT,
  PDF_SUPPORTED_HINT,
  classifyPdfFile,
  generatePdfFromFiles,
  type ClassifiedFile,
  type PdfFileKind,
  type PdfOrientation,
} from "@/utils/pdfGenerator";

type QueueItem = ClassifiedFile & { id: string };

const KIND_META: Record<
  PdfFileKind,
  { label: string; icon: typeof ImageIcon; color: string }
> = {
  image: { label: "Image", icon: ImageIcon, color: "text-emerald-400" },
  spreadsheet: { label: "Sheet", icon: Table2, color: "text-blue-400" },
  text: { label: "Text", icon: FileText, color: "text-amber-400" },
};

export function FileToPdf() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<PdfOrientation>("auto");

  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + item.file.size, 0),
    [items],
  );

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    const accepted: QueueItem[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const kind = classifyPdfFile(file);
      if (!kind) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        kind,
      });
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
    }
    if (rejected.length > 0) {
      setSkipped(rejected);
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setError(null);
  }, []);

  const moveItem = useCallback((id: string, direction: -1 | 1) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setSkipped([]);
    setError(null);
    setProgress(0);
    setStatus("");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (items.length === 0) return;

    setGenerating(true);
    setError(null);
    setProgress(0);
    setStatus("Starting…");

    try {
      const pdfBytes = await generatePdfFromFiles(
        items,
        (message, percent) => {
          setStatus(message);
          setProgress(percent);
        },
        { orientation },
      );

      const base =
        items.length === 1
          ? items[0].file.name.replace(/\.[^.]+$/, "")
          : "omniutil-combined";
      downloadBlob(
        new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" }),
        `${base}.pdf`,
      );
      setStatus("PDF ready — download started.");
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [items, orientation]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-blue-300">Universal File → PDF</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          100% client-side. Images, Excel/CSV, and text files merge into one
          polished PDF. Noto Sans + Noto Sans Bengali fonts ensure{" "}
          <span className="text-gray-200">বাংলা</span> and multilingual text
          render beautifully.
        </p>
      </div>

      <FileDropzone
        accept={PDF_ACCEPT}
        multiple
        disabled={generating}
        onFiles={addFiles}
        label="Drop files here or click to browse"
        hint={PDF_SUPPORTED_HINT}
      />

      {skipped.length > 0 && (
        <ToolErrorBanner
          title="Unsupported files skipped"
          message={skipped.join(", ")}
        />
      )}

      {error && <ToolStateWrapper error={error} />}

      {items.length > 0 && (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Layout
            </p>
            <div className="flex flex-wrap gap-2">
              <OrientationButton
                active={orientation === "auto"}
                onClick={() => setOrientation("auto")}
                disabled={generating}
                icon={Sparkles}
                label="Auto"
                hint="Recommended — column widths & page size adjust so nothing is cut off"
              />
              <OrientationButton
                active={orientation === "portrait"}
                onClick={() => setOrientation("portrait")}
                disabled={generating}
                icon={Smartphone}
                label="Portrait"
                hint="Fixed A4 vertical — images & text"
              />
              <OrientationButton
                active={orientation === "landscape"}
                onClick={() => setOrientation("landscape")}
                disabled={generating}
                icon={Monitor}
                label="Landscape"
                hint="Fixed A4 horizontal — wide tables on standard pages"
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                File queue ({items.length})
              </h2>
              <p className="text-xs text-gray-600">
                {formatBytes(totalSize)} total · order = page order in PDF
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                <Download className="h-4 w-4" />
                {generating ? "Creating PDF…" : "Create PDF"}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={generating}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {generating && (
            <div className="space-y-2 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, index) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800",
                        meta.color,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-100">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {meta.label} · {formatBytes(item.file.size)} · page{" "}
                        {index + 1}
                        {item.kind === "image" ? "+" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(item.id, -1)}
                      disabled={index === 0 || generating}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(item.id, 1)}
                      disabled={index === items.length - 1 || generating}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={generating}
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 && !generating && (
        <ToolStateWrapper
          isEmpty
          emptyIcon="📄"
          emptyMessage="Add images, Excel/CSV, or text files. Multiple images merge into one PDF."
        />
      )}
    </div>
  );
}

function OrientationButton({
  active,
  onClick,
  disabled,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Monitor;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-[140px] flex-1 flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors sm:max-w-xs",
        active
          ? "border-blue-500 bg-blue-500/10 text-blue-300"
          : "border-gray-700 bg-[#111827] text-gray-400 hover:border-gray-600 hover:text-gray-300",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-[11px] leading-snug text-gray-500">{hint}</span>
    </button>
  );
}
