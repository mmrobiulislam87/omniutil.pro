import Papa from "papaparse";

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
