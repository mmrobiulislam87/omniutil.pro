"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Trash2, X, FileArchive } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { downloadBlob, formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  compressImage,
  downloadImagesAsZip,
  isAcceptedImage,
  isAvifSupported,
  revokeProcessedImage,
  type ImageOutputFormat,
  type ProcessedImage,
} from "@/utils/imageProcessor";

type ProcessingItem = {
  id: string;
  name: string;
  status: "processing" | "done" | "error";
  error?: string;
  result?: ProcessedImage;
};

const BASE_FORMATS: { value: ImageOutputFormat; label: string }[] = [
  { value: "image/webp", label: "WebP" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
];

export function MediaOptimizer() {
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [format, setFormat] = useState<ImageOutputFormat>("image/webp");
  const [quality, setQuality] = useState(0.8);
  const [maxDimension, setMaxDimension] = useState(1920);
  const [zipping, setZipping] = useState(false);
  const [avifReady, setAvifReady] = useState(false);

  const formats = useMemo(
    () =>
      avifReady
        ? [...BASE_FORMATS, { value: "image/avif" as const, label: "AVIF" }]
        : BASE_FORMATS,
    [avifReady],
  );

  useEffect(() => {
    setAvifReady(isAvifSupported());
  }, []);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.result) revokeProcessedImage(item.result);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter(isAcceptedImage);
      if (valid.length === 0) return;

      const newItems: ProcessingItem[] = valid.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        status: "processing",
      }));

      setItems((prev) => [...newItems, ...prev]);

      await Promise.all(
        valid.map(async (file, index) => {
          const itemId = newItems[index].id;
          try {
            const result = await compressImage(file, {
              fileType: format,
              quality,
              maxWidthOrHeight: maxDimension,
            });
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? { ...item, status: "done", result }
                  : item,
              ),
            );
          } catch (error) {
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      status: "error",
                      error:
                        error instanceof Error
                          ? error.message
                          : "Compression failed",
                    }
                  : item,
              ),
            );
          }
        }),
      );
    },
    [format, quality, maxDimension],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.result) revokeProcessedImage(item.result);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.result) revokeProcessedImage(item.result);
      });
      return [];
    });
  }, []);

  const doneItems = items.filter((i) => i.status === "done" && i.result);
  const doneCount = doneItems.length;

  const handleDownloadZip = useCallback(async () => {
    const files = doneItems
      .map((i) => i.result!.file)
      .filter(Boolean);
    if (files.length === 0) return;

    setZipping(true);
    try {
      await downloadImagesAsZip(files, "omniutil-optimized.zip");
    } finally {
      setZipping(false);
    }
  }, [doneItems]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Output format</Label>
          <div className="flex flex-wrap gap-2">
            {formats.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  format === f.value
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!avifReady && (
            <p className="text-xs text-gray-600">
              AVIF unavailable in this browser
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality">
            Quality{" "}
            <span className="text-gray-500">({Math.round(quality * 100)}%)</span>
          </Label>
          <input
            id="quality"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dimension">Max dimension (px)</Label>
          <input
            id="dimension"
            type="number"
            min={320}
            max={4096}
            step={160}
            value={maxDimension}
            onChange={(e) => setMaxDimension(Number(e.target.value))}
            className="flex h-10 w-full rounded-lg border border-gray-700 bg-[#0B0F19] px-3 text-sm text-gray-100"
          />
        </div>
      </div>

      <FileDropzone
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
        multiple
        onFiles={processFiles}
        label="Drop images here or click to browse"
        hint="JPEG, PNG, WebP, GIF, BMP — multiple files supported"
      />

      {items.length > 0 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Results ({doneCount}/{items.length})
            </h2>
            <div className="flex gap-2">
              {doneCount > 1 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadZip}
                  disabled={zipping}
                >
                  {zipping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4" />
                  )}
                  Download ZIP ({doneCount})
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 sm:flex-row sm:items-center"
              >
                {item.status === "done" && item.result ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob preview URL
                  <img
                    src={item.result.previewUrl}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-lg border border-gray-700 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-800">
                    {item.status === "processing" ? (
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                    ) : (
                      <X className="h-6 w-6 text-red-400" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-100">
                    {item.name}
                  </p>
                  {item.status === "processing" && (
                    <p className="text-sm text-gray-500">Compressing…</p>
                  )}
                  {item.status === "error" && (
                    <ToolErrorBanner
                      message={item.error ?? "Compression failed"}
                      variant="inline"
                    />
                  )}
                  {item.status === "done" && item.result && (
                    <p className="text-sm text-gray-500">
                      {formatBytes(item.result.originalSize)} →{" "}
                      <span className="font-medium text-blue-400">
                        {formatBytes(item.result.compressedSize)}
                      </span>
                      {item.result.savingsPercent > 0 && (
                        <span className="ml-1 text-blue-400">
                          (−{item.result.savingsPercent}%)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {item.status === "done" && item.result && (
                    <Button
                      size="sm"
                      onClick={() =>
                        downloadBlob(item.result!.file, item.result!.file.name)
                      }
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
