import { PDFDocument, type PDFPage, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  getDataFileKind,
  parseCSVFile,
  parseExcelFile,
} from "@/utils/dataCleaner";

export type PdfFileKind = "image" | "spreadsheet" | "text";

export type ClassifiedFile = {
  file: File;
  kind: PdfFileKind;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

const FONT_LATIN_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const FONT_BENGALI_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp)$/i;
const TEXT_EXTENSIONS = /\.(txt|md|json|xml|html|log)$/i;

type FontSet = {
  latin: PDFFont;
  bengali: PDFFont;
};

let fontBytesCache: { latin: ArrayBuffer; bengali: ArrayBuffer } | null = null;

export function classifyPdfFile(file: File): PdfFileKind | null {
  if (file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name)) {
    return "image";
  }
  if (getDataFileKind(file)) return "spreadsheet";
  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name)) {
    return "text";
  }
  return null;
}

export function classifyPdfFiles(files: File[]): ClassifiedFile[] {
  return files
    .map((file) => {
      const kind = classifyPdfFile(file);
      return kind ? { file, kind } : null;
    })
    .filter((item): item is ClassifiedFile => item !== null);
}

async function loadFontBytes(): Promise<{ latin: ArrayBuffer; bengali: ArrayBuffer }> {
  if (fontBytesCache) return fontBytesCache;

  const [latin, bengali] = await Promise.all([
    fetch(FONT_LATIN_URL).then((response) => {
      if (!response.ok) throw new Error("Failed to load Unicode font (Latin).");
      return response.arrayBuffer();
    }),
    fetch(FONT_BENGALI_URL).then((response) => {
      if (!response.ok) throw new Error("Failed to load Unicode font (Bengali).");
      return response.arrayBuffer();
    }),
  ]);

  fontBytesCache = { latin, bengali };
  return fontBytesCache;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<FontSet> {
  pdfDoc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
  const [latin, bengali] = await Promise.all([
    pdfDoc.embedFont(bytes.latin, { subset: true }),
    pdfDoc.embedFont(bytes.bengali, { subset: true }),
  ]);
  return { latin, bengali };
}

function isBengaliChar(char: string): boolean {
  return /[\u0980-\u09FF]/.test(char);
}

function pickFont(char: string, fonts: FontSet): PDFFont {
  return isBengaliChar(char) ? fonts.bengali : fonts.latin;
}

function measureMixedText(text: string, fontSize: number, fonts: FontSet): number {
  let width = 0;
  for (const char of text) {
    width += pickFont(char, fonts).widthOfTextAtSize(char, fontSize);
  }
  return width;
}

function drawMixedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fonts: FontSet,
  color = rgb(0.12, 0.14, 0.18),
) {
  let cursorX = x;
  for (const char of text) {
    const font = pickFont(char, fonts);
    page.drawText(char, { x: cursorX, y, size: fontSize, font, color });
    cursorX += font.widthOfTextAtSize(char, fontSize);
  }
}

function wrapText(text: string, maxWidth: number, fontSize: number, fonts: FontSet): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/(\s+)/);
    let current = "";

    for (const word of words) {
      const candidate = current + word;
      if (measureMixedText(candidate, fontSize, fonts) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = word.trimStart();
      }
    }

    if (current) lines.push(current.trimEnd());
  }

  return lines.length > 0 ? lines : [""];
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  fonts: FontSet,
  maxLines?: number,
): { y: number; truncated: boolean } {
  const lines = wrapText(text, maxWidth, fontSize, fonts);
  const usable = maxLines ? lines.slice(0, maxLines) : lines;
  let y = startY;
  const lineHeight = fontSize * 1.45;

  for (const line of usable) {
    if (y < MARGIN) return { y, truncated: true };
    if (line) drawMixedText(page, line, x, y, fontSize, fonts);
    y -= lineHeight;
  }

  return { y, truncated: maxLines ? lines.length > maxLines : false };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

async function imageToEmbedBytes(
  file: File,
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "jpg" };
  }
  if (file.type === "image/png" || /\.png$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "png" };
  }

  const img = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for image conversion.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error(`Could not convert image: ${file.name}`));
    }, "image/png");
  });

  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: "png" };
}

async function addImagePages(
  pdfDoc: PDFDocument,
  file: File,
  fonts: FontSet,
) {
  const { bytes, kind } = await imageToEmbedBytes(file);
  const image =
    kind === "jpg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const maxW = CONTENT_WIDTH;
  const maxH = A4_HEIGHT - MARGIN * 2 - 24;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const x = MARGIN + (maxW - drawW) / 2;
  const y = MARGIN + (maxH - drawH) / 2;

  drawMixedText(page, file.name, MARGIN, A4_HEIGHT - MARGIN, 9, fonts, rgb(0.45, 0.48, 0.55));

  page.drawImage(image, {
    x,
    y,
    width: drawW,
    height: drawH,
  });
}

async function parseSpreadsheetRows(file: File): Promise<Record<string, string>[]> {
  const kind = getDataFileKind(file);
  if (kind === "excel") {
    const parsed = await parseExcelFile(file);
    return parsed.rows;
  }
  return parseCSVFile(file);
}

async function addSpreadsheetPages(
  pdfDoc: PDFDocument,
  file: File,
  fonts: FontSet,
) {
  const rows = await parseSpreadsheetRows(file);
  if (rows.length === 0) throw new Error(`No rows found in ${file.name}.`);

  const columns = Object.keys(rows[0]);
  const maxCols = Math.min(columns.length, 7);
  const visibleColumns = columns.slice(0, maxCols);
  const colWidth = CONTENT_WIDTH / maxCols;
  const fontSize = 8;
  const headerHeight = 22;
  const rowHeight = 18;
  const rowsPerPage = Math.floor(
    (A4_HEIGHT - MARGIN * 2 - 40 - headerHeight) / rowHeight,
  );

  for (let offset = 0; offset < rows.length; offset += rowsPerPage) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    let y = A4_HEIGHT - MARGIN;

    drawMixedText(
      page,
      `${file.name} — rows ${offset + 1}-${Math.min(offset + rowsPerPage, rows.length)} of ${rows.length}`,
      MARGIN,
      y,
      10,
      fonts,
      rgb(0.2, 0.24, 0.32),
    );
    y -= 24;

    visibleColumns.forEach((col, index) => {
      const x = MARGIN + index * colWidth;
      page.drawRectangle({
        x,
        y: y - headerHeight + 4,
        width: colWidth,
        height: headerHeight,
        color: rgb(0.93, 0.95, 0.98),
        borderColor: rgb(0.82, 0.86, 0.9),
        borderWidth: 0.5,
      });
      drawWrappedText(page, col, x + 4, y - 2, colWidth - 8, fontSize, fonts, 2);
    });
    y -= headerHeight;

    const pageRows = rows.slice(offset, offset + rowsPerPage);
    for (const row of pageRows) {
      visibleColumns.forEach((col, index) => {
        const x = MARGIN + index * colWidth;
        page.drawRectangle({
          x,
          y: y - rowHeight + 4,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0.88, 0.9, 0.94),
          borderWidth: 0.5,
        });
        const value = row[col] ?? "";
        drawWrappedText(page, value, x + 4, y - 2, colWidth - 8, fontSize - 0.5, fonts, 1);
      });
      y -= rowHeight;
      if (y < MARGIN) break;
    }

    if (columns.length > maxCols) {
      drawMixedText(
        page,
        `+${columns.length - maxCols} more columns not shown`,
        MARGIN,
        MARGIN - 4,
        7,
        fonts,
        rgb(0.5, 0.52, 0.58),
      );
    }
  }
}

async function addTextPages(pdfDoc: PDFDocument, file: File, fonts: FontSet) {
  const text = await file.text();
  const fontSize = 11;
  const lineHeight = fontSize * 1.45;
  const lines = wrapText(text, CONTENT_WIDTH, fontSize, fonts);
  const linesPerPage = Math.floor((A4_HEIGHT - MARGIN * 2 - 30) / lineHeight);

  for (let offset = 0; offset < lines.length; offset += linesPerPage) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    let y = A4_HEIGHT - MARGIN;

    drawMixedText(page, file.name, MARGIN, y, 10, fonts, rgb(0.2, 0.24, 0.32));
    y -= 26;

    const chunk = lines.slice(offset, offset + linesPerPage);
    for (const line of chunk) {
      if (line) drawMixedText(page, line, MARGIN, y, fontSize, fonts);
      y -= lineHeight;
    }
  }
}

export async function generatePdfFromFiles(
  files: ClassifiedFile[],
  onProgress?: (message: string, percent: number) => void,
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("Add at least one supported file.");
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("OmniUtil.pro — File to PDF");
  pdfDoc.setProducer("OmniUtil.pro (client-side)");

  onProgress?.("Loading Unicode fonts (বাংলা + global)…", 5);
  const fonts = await embedFonts(pdfDoc);

  const total = files.length;
  for (let index = 0; index < total; index++) {
    const { file, kind } = files[index];
    const base = 10 + Math.round((index / total) * 85);
    onProgress?.(`Processing ${file.name}…`, base);

    switch (kind) {
      case "image":
        await addImagePages(pdfDoc, file, fonts);
        break;
      case "spreadsheet":
        await addSpreadsheetPages(pdfDoc, file, fonts);
        break;
      case "text":
        await addTextPages(pdfDoc, file, fonts);
        break;
    }
  }

  onProgress?.("Finalizing PDF…", 98);
  return pdfDoc.save();
}

export const PDF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,.csv,.xlsx,.xls,.xlsm,text/plain,text/csv,text/markdown,.txt,.md,.json,.xml,.html";

export const PDF_SUPPORTED_HINT =
  "Images (JPG, PNG, WebP), Excel/CSV spreadsheets, and text files — বাংলা সহ যেকোনো ভাষা";
