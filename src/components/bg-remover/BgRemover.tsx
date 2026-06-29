"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import { downloadBlob } from "@/lib/format";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp";

const PRESET_COLORS = [
  { value: "transparent", label: "Transparent", className: "bg-gray-800 text-[10px] text-gray-400" },
  { value: "#ffffff", label: "White", className: "bg-white" },
  { value: "#000000", label: "Black", className: "bg-black" },
  { value: "#f3f4f6", label: "Light gray", className: "bg-gray-100" },
] as const;

export function BgRemover() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState("transparent");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const revokeUrls = useCallback((...urls: (string | null)[]) => {
    for (const url of urls) {
      if (url) URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    return () => revokeUrls(originalUrl, processedUrl);
  }, [originalUrl, processedUrl, revokeUrls]);

  const clearAll = useCallback(() => {
    revokeUrls(originalUrl, processedUrl);
    setOriginalUrl(null);
    setProcessedUrl(null);
    setBgColor("transparent");
    setProgress(0);
    setStatus("");
    setError(null);
  }, [originalUrl, processedUrl, revokeUrls]);

  const processFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || !file.type.startsWith("image/")) {
        setError("Please upload a valid image file (PNG, JPG, WebP).");
        return;
      }

      clearAll();
      setProcessing(true);
      setError(null);
      setProgress(0);
      setStatus("Loading AI model…");

      const previewUrl = URL.createObjectURL(file);
      setOriginalUrl(previewUrl);

      try {
        const { removeBackground } = await import("@imgly/background-removal");

        const blob = await removeBackground(file, {
          progress: (key, current, total) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            setProgress(pct);
            setStatus(
              key === "fetch:weights"
                ? `Downloading AI model… ${pct}%`
                : `Removing background… ${pct}%`,
            );
          },
        });

        setProcessedUrl(URL.createObjectURL(blob));
        setStatus("Done");
        setProgress(100);
      } catch (err) {
        console.error(err);
        revokeUrls(previewUrl);
        setOriginalUrl(null);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to process image. Try a different file or browser.",
        );
      } finally {
        setProcessing(false);
      }
    },
    [clearAll, revokeUrls],
  );

  const downloadImage = useCallback(async () => {
    if (!processedUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load processed image."));
      img.src = processedUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `omniutil-bg-removed-${Date.now()}.png`);
    }, "image/png");
  }, [bgColor, processedUrl]);

  const showResults = Boolean(originalUrl && processedUrl && !processing);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-indigo-300">On-device AI · ONNX + WebGL</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          The AI model downloads once and runs entirely in your browser — no
          uploads, no server bills, no privacy compromise. First run may take a
          moment while the model caches; subsequent images process much faster.
        </p>
      </div>

      {!originalUrl && !processing && (
        <FileDropzone
          accept={ACCEPT}
          disabled={processing}
          onFiles={processFile}
          label="Drop an image here or click to browse"
          hint="PNG, JPG, JPEG, WebP · processed locally on your GPU/CPU"
        />
      )}

      {error && <ToolStateWrapper error={error} />}

      {processing && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-6">
          <ToolStateWrapper
            isLoading={progress < 5}
            loadingMessage={status || "Initializing AI…"}
          />
          {progress >= 5 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {originalUrl && (
                <div className="mt-4 flex justify-center rounded-xl border border-gray-800 bg-gray-950 p-4">
                  <img
                    src={originalUrl}
                    alt="Original preview"
                    className="max-h-48 max-w-full object-contain opacity-60"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showResults && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Original
              </p>
              <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-gray-800 bg-gray-950 p-4">
                <img
                  src={originalUrl!}
                  alt="Original"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Background removed
              </p>
              <div
                className={cn(
                  "flex h-64 items-center justify-center overflow-hidden rounded-xl border border-gray-800 p-4 transition-colors duration-200",
                  bgColor === "transparent" ? "checkboard-bg" : "",
                )}
                style={
                  bgColor !== "transparent"
                    ? { backgroundColor: bgColor }
                    : undefined
                }
              >
                <img
                  src={processedUrl!}
                  alt="Background removed"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-gray-400">
                Background color:
              </span>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setBgColor(preset.value)}
                    title={preset.label}
                    aria-label={preset.label}
                    className={cn(
                      "h-7 w-7 rounded-full border transition",
                      preset.className,
                      bgColor === preset.value
                        ? "scale-110 border-blue-500"
                        : "border-gray-700 hover:border-gray-500",
                    )}
                  >
                    {preset.value === "transparent" ? "✕" : null}
                  </button>
                ))}
                <input
                  type="color"
                  value={bgColor === "transparent" ? "#ffffff" : bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-gray-700 bg-transparent p-0"
                  title="Custom color"
                  aria-label="Custom background color"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <Button size="sm" onClick={downloadImage}>
                <Download className="h-4 w-4" />
                Download HD PNG
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
