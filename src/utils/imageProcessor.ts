import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { downloadBlob } from "@/lib/format";

export type ImageOutputFormat =
  | "image/webp"
  | "image/jpeg"
  | "image/png"
  | "image/avif";

export type ImageCompressionOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  fileType?: ImageOutputFormat;
  quality?: number;
};

export type ProcessedImage = {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
};

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
];

let avifSupportCache: boolean | null = null;

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

export function isAvifSupported(): boolean {
  if (typeof document === "undefined") return false;
  if (avifSupportCache !== null) return avifSupportCache;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  avifSupportCache = canvas.toDataURL("image/avif").startsWith("data:image/avif");
  return avifSupportCache;
}

async function compressViaCanvas(
  file: File,
  options: ImageCompressionOptions,
): Promise<ProcessedImage> {
  const {
    maxWidthOrHeight = 1920,
    fileType = "image/webp",
    quality = 0.8,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = (height / width) * maxWidthOrHeight;
          width = maxWidthOrHeight;
        } else {
          width = (width / height) * maxWidthOrHeight;
          height = maxWidthOrHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }

          const ext = fileType.split("/")[1] ?? "webp";
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${ext}`),
            { type: fileType },
          );

          resolve({
            file: compressed,
            previewUrl: URL.createObjectURL(compressed),
            originalSize: file.size,
            compressedSize: compressed.size,
            savingsPercent:
              file.size > 0
                ? Math.round(((file.size - compressed.size) / file.size) * 100)
                : 0,
          });
        },
        fileType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<ProcessedImage> {
  const {
    maxSizeMB = 10,
    maxWidthOrHeight = 1920,
    fileType = "image/webp",
    quality = 0.8,
  } = options;

  if (fileType === "image/avif") {
    if (!isAvifSupported()) {
      throw new Error(
        "AVIF is not supported in this browser. Please use WebP instead.",
      );
    }
    return compressViaCanvas(file, options);
  }

  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    fileType,
    initialQuality: quality,
    useWebWorker: true,
    alwaysKeepResolution: false,
  });

  const ext = fileType.split("/")[1] ?? "webp";
  const renamed = new File(
    [compressed],
    file.name.replace(/\.[^.]+$/, `.${ext}`),
    { type: fileType },
  );

  const savingsPercent =
    file.size > 0
      ? Math.round(((file.size - renamed.size) / file.size) * 100)
      : 0;

  return {
    file: renamed,
    previewUrl: URL.createObjectURL(renamed),
    originalSize: file.size,
    compressedSize: renamed.size,
    savingsPercent,
  };
}

export function revokeProcessedImage(image: ProcessedImage) {
  URL.revokeObjectURL(image.previewUrl);
}

export async function downloadImagesAsZip(
  files: File[],
  zipName = "optimized-images.zip",
) {
  if (files.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const file of files) {
    let name = file.name;
    let counter = 1;
    while (usedNames.has(name)) {
      const dot = file.name.lastIndexOf(".");
      const base = dot > 0 ? file.name.slice(0, dot) : file.name;
      const ext = dot > 0 ? file.name.slice(dot) : "";
      name = `${base}-${counter}${ext}`;
      counter++;
    }
    usedNames.add(name);
    zip.file(name, file);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}
