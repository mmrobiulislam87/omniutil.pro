import Papa from "papaparse";

export type DataFileKind = "csv" | "excel";

export type ParsedDataFile = {
  rows: Record<string, string>[];
  kind: DataFileKind;
  sheetNames: string[];
  activeSheet?: string;
};

export type CleanOptions = {
  removeDuplicates?: boolean;
  validateEmails?: boolean;
  validatePhones?: boolean;
  emailColumn?: string;
  phoneColumn?: string;
};

export type CleanResult = {
  rows: Record<string, string>[];
  removedDuplicates: number;
  invalidEmails: number;
  invalidPhones: number;
  totalRows: number;
  originalRows: number;
};

export type ParseProgress = {
  parsed: number;
  total?: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.trim());
}

export function parseCSVFile(
  file: File,
  onProgress?: (progress: ParseProgress) => void,
): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      chunkSize: 1024 * 512,
      chunk: (results) => {
        rows.push(...results.data);
        onProgress?.({ parsed: rows.length });
      },
      complete: () => {
        onProgress?.({ parsed: rows.length, total: rows.length });
        resolve(rows);
      },
      error: (error) => reject(error),
    });
  });
}

export function deduplicateRows(
  rows: Record<string, string>[],
): { unique: Record<string, string>[]; removed: number } {
  const seen = new Set<string>();
  const unique: Record<string, string>[] = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return { unique, removed: rows.length - unique.length };
}

export function cleanData(
  rows: Record<string, string>[],
  options: CleanOptions = {},
): CleanResult {
  const {
    removeDuplicates = true,
    validateEmails = false,
    validatePhones = false,
    emailColumn,
    phoneColumn,
  } = options;

  const originalRows = rows.length;
  let working = [...rows];
  let removedDuplicates = 0;
  let invalidEmails = 0;
  let invalidPhones = 0;

  if (removeDuplicates) {
    const result = deduplicateRows(working);
    working = result.unique;
    removedDuplicates = result.removed;
  }

  if (validateEmails && emailColumn) {
    working = working.filter((row) => {
      const email = row[emailColumn] ?? "";
      if (!email.trim()) return true;
      const valid = isValidEmail(email);
      if (!valid) invalidEmails++;
      return valid;
    });
  }

  if (validatePhones && phoneColumn) {
    working = working.filter((row) => {
      const phone = row[phoneColumn] ?? "";
      if (!phone.trim()) return true;
      const valid = isValidPhone(phone);
      if (!valid) invalidPhones++;
      return valid;
    });
  }

  return {
    rows: working,
    removedDuplicates,
    invalidEmails,
    invalidPhones,
    totalRows: working.length,
    originalRows,
  };
}

export function rowsToCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  return Papa.unparse(rows);
}

export function getColumnNames(rows: Record<string, string>[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

export function guessEmailColumn(columns: string[]): string | undefined {
  return columns.find((col) => /e-?mail/i.test(col));
}

export function guessPhoneColumn(columns: string[]): string | undefined {
  return columns.find((col) => /phone|mobile|tel/i.test(col));
}

const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".xlsm"];
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

export function getDataFileKind(file: File): DataFileKind | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || file.type === "text/csv") return "csv";
  if (
    EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    EXCEL_MIME_TYPES.has(file.type)
  ) {
    return "excel";
  }
  return null;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().replace(/T.*/, "");
  }
  return String(value).trim();
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    if (!key || key.startsWith("__EMPTY")) continue;
    normalized[key] = cellToString(value);
  }

  return normalized;
}

export function filterRowsByColumns(
  rows: Record<string, string>[],
  includedColumns: string[],
): Record<string, string>[] {
  if (includedColumns.length === 0) return rows;

  return rows.map((row) => {
    const filtered: Record<string, string> = {};
    for (const column of includedColumns) {
      filtered[column] = row[column] ?? "";
    }
    return filtered;
  });
}

export async function parseExcelFile(
  file: File,
  options: { sheetName?: string } = {},
  onProgress?: (progress: ParseProgress) => void,
): Promise<ParsedDataFile> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dense: false,
  });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error("No worksheets found in this Excel file.");
  }

  const activeSheet = options.sheetName ?? sheetNames[0];
  if (!sheetNames.includes(activeSheet)) {
    throw new Error(`Worksheet "${activeSheet}" was not found.`);
  }

  const worksheet = workbook.Sheets[activeSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  const rows = rawRows
    .map(normalizeRow)
    .filter((row) => Object.keys(row).length > 0);

  onProgress?.({ parsed: rows.length, total: rows.length });

  return {
    rows,
    kind: "excel",
    sheetNames,
    activeSheet,
  };
}

export async function parseDataFile(
  file: File,
  options: { sheetName?: string } = {},
  onProgress?: (progress: ParseProgress) => void,
): Promise<ParsedDataFile> {
  const kind = getDataFileKind(file);
  if (!kind) {
    throw new Error("Unsupported file type. Please upload a CSV or Excel file.");
  }

  if (kind === "excel") {
    return parseExcelFile(file, options, onProgress);
  }

  const rows = await parseCSVFile(file, onProgress);
  return { rows, kind: "csv", sheetNames: [] };
}
