import { PDFDocument, type PDFPage, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  getDataFileKind,
  parseCSVFile,
  parseExcelFile,
} from "@/utils/dataCleaner";

export type PdfFileKind = "image" | "spreadsheet" | "text";
export type PdfOrientation = "auto" | "portrait" | "landscape";

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
const MAX_PAGE_WIDTH = 1440;
const MAX_COL_WIDTH = 220;
const MIN_COL_WIDTH = 30;
const CELL_PAD = 5;
const MAX_CELL_LINES = 4;
const WIDTH_SAMPLE_ROWS = 300;

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

function getPageLayout(orientation: Exclude<PdfOrientation, "auto">): PageLayout {
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

function resolveMediaOrientation(orientation: PdfOrientation): Exclude<PdfOrientation, "auto"> {
  return orientation === "landscape" ? "landscape" : "portrait";
}

type ColumnGroup = {
  columnNames: string[];
  widths: number[];
};

function sampleRowsForMeasure(
  rows: Record<string, string>[],
  limit = WIDTH_SAMPLE_ROWS,
): Record<string, string>[] {
  if (rows.length <= limit) return rows;
  const picked: Record<string, string>[] = [];
  const step = rows.length / limit;
  for (let i = 0; i < limit; i++) {
    picked.push(rows[Math.floor(i * step)]);
  }
  return picked;
}

function measureColumnWidths(
  columns: string[],
  rows: Record<string, string>[],
  fonts: FontSet,
  fontSize: number,
): number[] {
  const sample = sampleRowsForMeasure(rows);
  return columns.map((col) => {
    let maxW = measureMixedText(col, fontSize, fonts);
    for (const row of sample) {
      const value = row[col] ?? "";
      const lines = wrapText(value, MAX_COL_WIDTH - CELL_PAD * 2, fontSize, fonts);
      for (const line of lines.slice(0, MAX_CELL_LINES)) {
        maxW = Math.max(maxW, measureMixedText(line, fontSize, fonts));
      }
    }
    return Math.min(
      Math.max(Math.ceil(maxW) + CELL_PAD * 2, MIN_COL_WIDTH),
      MAX_COL_WIDTH,
    );
  });
}

function pickSpreadsheetFontSize(columnWidths: number[]): number {
  const avg = columnWidths.reduce((a, b) => a + b, 0) / columnWidths.length;
  if (avg >= 90) return 9;
  if (avg >= 65) return 8;
  if (avg >= 45) return 7;
  return 6;
}

function packColumnGroups(
  columns: string[],
  widths: number[],
  maxPackWidth: number,
): ColumnGroup[] {
  const groups: ColumnGroup[] = [];
  let columnNames: string[] = [];
  let groupWidths: number[] = [];
  let total = 0;

  const flush = () => {
    if (columnNames.length > 0) {
      groups.push({ columnNames: [...columnNames], widths: [...groupWidths] });
    }
    columnNames = [];
    groupWidths = [];
    total = 0;
  };

  for (let i = 0; i < columns.length; i++) {
    const w = widths[i];
    if (columnNames.length > 0 && total + w > maxPackWidth) flush();
    columnNames.push(columns[i]);
    groupWidths.push(w);
    total += w;
  }
  flush();
  return groups;
}

function getColumnPackBudget(orientation: PdfOrientation): number {
  if (orientation === "portrait") return A4_SHORT - MARGIN * 2;
  return MAX_PAGE_WIDTH - MARGIN * 2;
}

function pageSizeForColumnGroup(
  group: ColumnGroup,
  orientation: PdfOrientation,
): { width: number; height: number } {
  const contentWidth = group.widths.reduce((sum, w) => sum + w, 0);

  if (orientation === "portrait") {
    return { width: A4_SHORT, height: A4_LONG };
  }

  const width = Math.min(
    Math.max(contentWidth + MARGIN * 2, A4_LONG),
    MAX_PAGE_WIDTH,
  );
  return { width, height: A4_SHORT };
}

function getCellLines(
  text: string,
  colWidth: number,
  fontSize: number,
  fonts: FontSet,
): string[] {
  const lines = wrapText(text, colWidth - CELL_PAD * 2, fontSize, fonts);
  if (lines.length === 0) return [""];
  return lines.slice(0, MAX_CELL_LINES);
}

function drawCell(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  colWidth: number,
  rowHeight: number,
  fontSize: number,
  fonts: FontSet,
  header = false,
) {
  page.drawRectangle({
    x,
    y: topY - rowHeight + 4,
    width: colWidth,
    height: rowHeight,
    color: header ? rgb(0.93, 0.95, 0.98) : undefined,
    borderColor: rgb(0.86, 0.88, 0.92),
    borderWidth: 0.35,
  });

  const lines = getCellLines(text, colWidth, fontSize, fonts);
  const lineHeight = fontSize * 1.35;
  let textY = topY - fontSize - 3;

  for (const line of lines) {
    if (!line) continue;
    drawMixedText(
      page,
      line,
      x + CELL_PAD,
      textY,
      fontSize,
      fonts,
      header ? rgb(0.15, 0.18, 0.24) : rgb(0.12, 0.14, 0.18),
    );
    textY -= lineHeight;
  }
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

function getSpreadsheetPlan(
  columns: string[],
  rows: Record<string, string>[],
  fonts: FontSet,
  orientation: PdfOrientation,
) {
  const sheetOrientation: PdfOrientation =
    orientation === "auto" ? "landscape" : orientation;

  let fontSize = 8;
  let columnWidths = measureColumnWidths(columns, rows, fonts, fontSize);
  fontSize = pickSpreadsheetFontSize(columnWidths);

  for (let attempt = 0; attempt < 3; attempt++) {
    columnWidths = measureColumnWidths(columns, rows, fonts, fontSize);
    const budget = getColumnPackBudget(sheetOrientation);
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
    if (totalWidth <= budget || fontSize <= 6) break;
    fontSize -= 1;
  }

  const groups = packColumnGroups(columns, columnWidths, getColumnPackBudget(sheetOrientation));
  const lineHeight = fontSize * 1.35;
  const rowHeight = MAX_CELL_LINES * lineHeight + CELL_PAD;
  const headerHeight = 2 * lineHeight + CELL_PAD + 4;

  return { groups, fontSize, rowHeight, headerHeight, sheetOrientation };
}

async function addSpreadsheetPages(
  pdfDoc: PDFDocument,
  file: File,
  fonts: FontSet,
  orientation: PdfOrientation,
  onProgress?: (message: string, percent: number) => void,
  progressBase = 0,
  progressSpan = 10,
) {
  const rows = await parseSpreadsheetRows(file);
  if (rows.length === 0) throw new Error(`No rows found in ${file.name}.`);

  const columns = Object.keys(rows[0]);
  const plan = getSpreadsheetPlan(columns, rows, fonts, orientation);
  const { groups, fontSize, rowHeight, headerHeight, sheetOrientation } = plan;

  let totalPages = 0;
  for (const group of groups) {
    const { width, height } = pageSizeForColumnGroup(group, sheetOrientation);
    const contentHeight = height - MARGIN * 2;
    const rowsPerPage = Math.max(
      1,
      Math.floor((contentHeight - 28 - headerHeight) / rowHeight),
    );
    totalPages += Math.ceil(rows.length / rowsPerPage);
  }

  let pagesBuilt = 0;
  let yieldCounter = 0;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    const { width: pageWidth, height: pageHeight } = pageSizeForColumnGroup(
      group,
      sheetOrientation,
    );
    const contentHeight = pageHeight - MARGIN * 2;
    const rowsPerPage = Math.max(
      1,
      Math.floor((contentHeight - 28 - headerHeight) / rowHeight),
    );

    for (let rowStart = 0; rowStart < rows.length; rowStart += rowsPerPage) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - MARGIN;
      const rowEnd = Math.min(rowStart + rowsPerPage, rows.length);
      const colStart = columns.indexOf(group.columnNames[0]) + 1;
      const colEnd = colStart + group.columnNames.length - 1;

      drawMixedText(
        page,
        `${file.name} · columns ${colStart}–${colEnd} of ${columns.length} · rows ${rowStart + 1}–${rowEnd} of ${rows.length} · ${Math.round(pageWidth)}×${Math.round(pageHeight)}pt`,
        MARGIN,
        y,
        7,
        fonts,
        rgb(0.35, 0.38, 0.45),
      );
      y -= 20;

      let x = MARGIN;
      for (let i = 0; i < group.columnNames.length; i++) {
        drawCell(
          page,
          group.columnNames[i],
          x,
          y,
          group.widths[i],
          headerHeight,
          fontSize,
          fonts,
          true,
        );
        x += group.widths[i];
      }
      y -= headerHeight;

      for (const row of rows.slice(rowStart, rowEnd)) {
        x = MARGIN;
        for (let i = 0; i < group.columnNames.length; i++) {
          const col = group.columnNames[i];
          drawCell(
            page,
            row[col] ?? "",
            x,
            y,
            group.widths[i],
            rowHeight,
            fontSize - 0.5,
            fonts,
          );
          x += group.widths[i];
        }
        y -= rowHeight;
      }

      pagesBuilt++;
      yieldCounter++;
      if (await yieldToBrowser(yieldCounter)) yieldCounter = 0;

      const pct = progressBase + Math.round((pagesBuilt / totalPages) * progressSpan);
      onProgress?.(
        `${file.name}: sheet ${groupIndex + 1}/${groups.length} · page ${pagesBuilt}/${totalPages}`,
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

  const orientation = options.orientation ?? "auto";
  const mediaLayout = getPageLayout(resolveMediaOrientation(orientation));

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
        await addImagePages(pdfDoc, file, fonts, mediaLayout);
        break;
      case "spreadsheet":
        await addSpreadsheetPages(
          pdfDoc,
          file,
          fonts,
          orientation,
          onProgress,
          base,
          span,
        );
        break;
      case "text":
        await addTextPages(pdfDoc, file, fonts, mediaLayout);
        break;
    }
  }

  onProgress?.("Finalizing PDF…", 98);
  return pdfDoc.save();
}

export const PDF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,.csv,.xlsx,.xls,.xlsm,text/plain,text/csv,text/markdown,.txt,.md,.json,.xml,.html";

export const PDF_SUPPORTED_HINT =
  "Images, Excel/CSV, text — Auto layout fits all columns · বাংলা supported";
