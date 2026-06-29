import { PDFDocument, type PDFPage, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  getDataFileKind,
  parseCSVFile,
  parseExcelFile,
} from "@/utils/dataCleaner";

export type PdfFileKind = "image" | "spreadsheet" | "text";
export type PdfOrientation = "portrait" | "landscape";

export type ClassifiedFile = {
  file: File;
  kind: PdfFileKind;
};

export type PdfGenerateOptions = {
  orientation?: PdfOrientation;
};

type PageLayout = {
  width: number;
  height: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
};

const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 40;

const FONT_LATIN_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const FONT_BENGALI_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp)$/i;
const TEXT_EXTENSIONS = /\.(txt|md|json|xml|html|log)$/i;
const YIELD_EVERY_PAGES = 8;

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

function getPageLayout(orientation: PdfOrientation): PageLayout {
  const width = orientation === "landscape" ? A4_LONG : A4_SHORT;
  const height = orientation === "landscape" ? A4_SHORT : A4_LONG;
  return {
    width,
    height,
    margin: MARGIN,
    contentWidth: width - MARGIN * 2,
    contentHeight: height - MARGIN * 2,
  };
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

function truncateToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  fonts: FontSet,
): string {
  const value = text.trim();
  if (!value) return "";
  if (measureMixedText(value, fontSize, fonts) <= maxWidth) return value;

  const ellipsis = "…";
  let trimmed = value;
  while (
    trimmed.length > 0 &&
    measureMixedText(trimmed + ellipsis, fontSize, fonts) > maxWidth
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? trimmed + ellipsis : ellipsis;
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

async function yieldToBrowser(pagesSinceYield: number): Promise<boolean> {
  if (pagesSinceYield >= YIELD_EVERY_PAGES) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return true;
  }
  return false;
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
  layout: PageLayout,
) {
  const { bytes, kind } = await imageToEmbedBytes(file);
  const image =
    kind === "jpg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

  const page = pdfDoc.addPage([layout.width, layout.height]);
  const maxW = layout.contentWidth;
  const maxH = layout.contentHeight - 20;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const x = layout.margin + (maxW - drawW) / 2;
  const y = layout.margin + (maxH - drawH) / 2;

  drawMixedText(
    page,
    file.name,
    layout.margin,
    layout.height - layout.margin,
    9,
    fonts,
    rgb(0.45, 0.48, 0.55),
  );

  page.drawImage(image, { x, y, width: drawW, height: drawH });
}

async function parseSpreadsheetRows(file: File): Promise<Record<string, string>[]> {
  const kind = getDataFileKind(file);
  if (kind === "excel") {
    const parsed = await parseExcelFile(file);
    return parsed.rows;
  }
  return parseCSVFile(file);
}

function getSpreadsheetMetrics(columnCount: number, layout: PageLayout) {
  const minColWidth =
    columnCount > 30 ? 28 : columnCount > 20 ? 34 : columnCount > 12 ? 40 : 48;
  const colsPerPage = Math.max(
    1,
    Math.floor(layout.contentWidth / minColWidth),
  );
  const fontSize = Math.max(5, Math.min(9, 360 / columnCount));
  const rowHeight = Math.max(12, Math.ceil(fontSize * 1.65));
  const headerHeight = rowHeight + 6;
  const rowsPerPage = Math.max(
    1,
    Math.floor((layout.contentHeight - 36 - headerHeight) / rowHeight),
  );

  return { colsPerPage, fontSize, rowHeight, headerHeight, rowsPerPage, minColWidth };
}

async function addSpreadsheetPages(
  pdfDoc: PDFDocument,
  file: File,
  fonts: FontSet,
  layout: PageLayout,
  onProgress?: (message: string, percent: number) => void,
  progressBase = 0,
  progressSpan = 10,
) {
  const rows = await parseSpreadsheetRows(file);
  if (rows.length === 0) throw new Error(`No rows found in ${file.name}.`);

  const columns = Object.keys(rows[0]);
  const metrics = getSpreadsheetMetrics(columns.length, layout);
  const {
    colsPerPage,
    fontSize,
    rowHeight,
    headerHeight,
    rowsPerPage,
  } = metrics;

  const colChunks = Math.ceil(columns.length / colsPerPage);
  const rowChunks = Math.ceil(rows.length / rowsPerPage);
  const totalPages = colChunks * rowChunks;
  let pagesBuilt = 0;
  let yieldCounter = 0;

  for (let colStart = 0; colStart < columns.length; colStart += colsPerPage) {
    const visibleColumns = columns.slice(colStart, colStart + colsPerPage);
    const colWidth = layout.contentWidth / visibleColumns.length;
    const cellPadding = 3;

    for (let rowStart = 0; rowStart < rows.length; rowStart += rowsPerPage) {
      const page = pdfDoc.addPage([layout.width, layout.height]);
      let y = layout.height - layout.margin;
      const rowEnd = Math.min(rowStart + rowsPerPage, rows.length);
      const colEnd = Math.min(colStart + colsPerPage, columns.length);

      drawMixedText(
        page,
        `${file.name} · cols ${colStart + 1}–${colEnd} of ${columns.length} · rows ${rowStart + 1}–${rowEnd} of ${rows.length}`,
        layout.margin,
        y,
        8,
        fonts,
        rgb(0.2, 0.24, 0.32),
      );
      y -= 22;

      visibleColumns.forEach((col, index) => {
        const x = layout.margin + index * colWidth;
        page.drawRectangle({
          x,
          y: y - headerHeight + 4,
          width: colWidth,
          height: headerHeight,
          color: rgb(0.93, 0.95, 0.98),
          borderColor: rgb(0.82, 0.86, 0.9),
          borderWidth: 0.4,
        });
        const header = truncateToWidth(
          col,
          colWidth - cellPadding * 2,
          fontSize,
          fonts,
        );
        if (header) {
          drawMixedText(
            page,
            header,
            x + cellPadding,
            y - fontSize - 2,
            fontSize,
            fonts,
            rgb(0.15, 0.18, 0.24),
          );
        }
      });
      y -= headerHeight;

      const pageRows = rows.slice(rowStart, rowEnd);
      for (const row of pageRows) {
        visibleColumns.forEach((col, index) => {
          const x = layout.margin + index * colWidth;
          page.drawRectangle({
            x,
            y: y - rowHeight + 4,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0.9, 0.91, 0.94),
            borderWidth: 0.35,
          });
          const value = truncateToWidth(
            row[col] ?? "",
            colWidth - cellPadding * 2,
            fontSize - 0.5,
            fonts,
          );
          if (value) {
            drawMixedText(
              page,
              value,
              x + cellPadding,
              y - fontSize - 1,
              fontSize - 0.5,
              fonts,
            );
          }
        });
        y -= rowHeight;
      }

      pagesBuilt++;
      yieldCounter++;
      if (await yieldToBrowser(yieldCounter)) yieldCounter = 0;

      const pct = progressBase + Math.round((pagesBuilt / totalPages) * progressSpan);
      onProgress?.(
        `${file.name}: page ${pagesBuilt}/${totalPages} (${columns.length} cols, ${rows.length} rows)`,
        pct,
      );
    }
  }
}

async function addTextPages(
  pdfDoc: PDFDocument,
  file: File,
  fonts: FontSet,
  layout: PageLayout,
) {
  const text = await file.text();
  const fontSize = 10;
  const lineHeight = fontSize * 1.45;
  const lines = wrapText(text, layout.contentWidth, fontSize, fonts);
  const linesPerPage = Math.max(
    1,
    Math.floor((layout.contentHeight - 28) / lineHeight),
  );

  let yieldCounter = 0;
  for (let offset = 0; offset < lines.length; offset += linesPerPage) {
    const page = pdfDoc.addPage([layout.width, layout.height]);
    let y = layout.height - layout.margin;

    drawMixedText(
      page,
      file.name,
      layout.margin,
      y,
      10,
      fonts,
      rgb(0.2, 0.24, 0.32),
    );
    y -= 24;

    for (const line of lines.slice(offset, offset + linesPerPage)) {
      if (line) drawMixedText(page, line, layout.margin, y, fontSize, fonts);
      y -= lineHeight;
    }

    yieldCounter++;
    if (await yieldToBrowser(yieldCounter)) yieldCounter = 0;
  }
}

export async function generatePdfFromFiles(
  files: ClassifiedFile[],
  onProgress?: (message: string, percent: number) => void,
  options: PdfGenerateOptions = {},
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("Add at least one supported file.");
  }

  const orientation = options.orientation ?? "portrait";
  const layout = getPageLayout(orientation);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("OmniUtil.pro — File to PDF");
  pdfDoc.setProducer("OmniUtil.pro (client-side)");

  onProgress?.("Loading Unicode fonts (বাংলা + global)…", 5);
  const fonts = await embedFonts(pdfDoc);

  const total = files.length;
  for (let index = 0; index < total; index++) {
    const { file, kind } = files[index];
    const span = 85 / total;
    const base = 10 + index * span;

    onProgress?.(`Processing ${file.name}…`, Math.round(base));

    switch (kind) {
      case "image":
        await addImagePages(pdfDoc, file, fonts, layout);
        break;
      case "spreadsheet":
        await addSpreadsheetPages(
          pdfDoc,
          file,
          fonts,
          layout,
          onProgress,
          base,
          span,
        );
        break;
      case "text":
        await addTextPages(pdfDoc, file, fonts, layout);
        break;
    }
  }

  onProgress?.("Finalizing PDF…", 98);
  return pdfDoc.save();
}

export const PDF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,.csv,.xlsx,.xls,.xlsm,text/plain,text/csv,text/markdown,.txt,.md,.json,.xml,.html";

export const PDF_SUPPORTED_HINT =
  "Images, Excel/CSV (all columns), text — Portrait or Landscape · বাংলা supported";
