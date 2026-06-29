export type TacEntry = {
  brand: string;
  model: string;
  name?: string;
};

export type ImeiLookupResult = {
  imei: string;
  valid: boolean;
  luhnValid: boolean;
  tac: string;
  serialNumber: string;
  checkDigit: string;
  reportingBody: string;
  device: TacEntry | null;
  databaseLoaded: boolean;
  databaseSize: number;
};

const REPORTING_BODIES: Record<string, string> = {
  "00": "Test / internal",
  "01": "United States (CTIA)",
  "30": "South Korea",
  "33": "France",
  "35": "United States",
  "44": "United Kingdom",
  "49": "Germany",
  "50": "Belgium / Luxembourg",
  "51": "United States",
  "52": "Mexico",
  "53": "Cuba",
  "54": "Argentina",
  "86": "China",
  "91": "India",
  "99": "International / shared",
};

let tacIndex: Map<string, TacEntry> | null = null;
let databaseSize = 0;

/** Compact rows: [tac, brand, model, marketingName?] */
const BUILTIN_TAC_ROWS: (string | undefined)[][] = [
  ["01326300", "Apple", "iPhone 5", "iPhone 5"],
  ["01355400", "Apple", "iPhone 5S", "iPhone 5S"],
  ["01374400", "Apple", "iPhone 6", "iPhone 6"],
  ["35209900", "Apple", "iPhone 6", "iPhone 6"],
  ["35328500", "Apple", "iPhone 6S", "iPhone 6S"],
  ["35332510", "Apple", "iPhone 7", "iPhone 7"],
  ["35375509", "Apple", "iPhone 7 Plus", "iPhone 7 Plus"],
  ["35428009", "Apple", "iPhone 8", "iPhone 8"],
  ["35464910", "Apple", "iPhone 8 Plus", "iPhone 8 Plus"],
  ["35672510", "Apple", "iPhone X", "iPhone X"],
  ["35311110", "Apple", "iPhone XS", "iPhone XS"],
  ["35391110", "Apple", "iPhone XS Max", "iPhone XS Max"],
  ["35397610", "Apple", "iPhone XR", "iPhone XR"],
  ["35391111", "Apple", "iPhone 11", "iPhone 11"],
  ["35391211", "Apple", "iPhone 11 Pro", "iPhone 11 Pro"],
  ["35391311", "Apple", "iPhone 11 Pro Max", "iPhone 11 Pro Max"],
  ["35117339", "Apple", "iPhone 14", "iPhone 14"],
  ["35117340", "Apple", "iPhone 14", "iPhone 14"],
  ["35154341", "Apple", "iPhone 14 Pro", "iPhone 14 Pro"],
  ["35154441", "Apple", "iPhone 14 Pro Max", "iPhone 14 Pro Max"],
  ["35397810", "Samsung", "SM-S911B", "Galaxy S23"],
  ["35397910", "Samsung", "SM-S916B", "Galaxy S23+"],
  ["35398010", "Samsung", "SM-S918B", "Galaxy S23 Ultra"],
  ["35260911", "Samsung", "SM-S901B", "Galaxy S22"],
  ["35261011", "Samsung", "SM-S906B", "Galaxy S22+"],
  ["35261111", "Samsung", "SM-S908B", "Galaxy S22 Ultra"],
  ["35929056", "Samsung", "SM-A525F", "Galaxy A52"],
  ["35929057", "Samsung", "SM-A525F", "Galaxy A52"],
  ["35956610", "Samsung", "SM-A536B", "Galaxy A53 5G"],
  ["35956710", "Samsung", "SM-A536B", "Galaxy A53 5G"],
  ["35925411", "Samsung", "SM-A546B", "Galaxy A54 5G"],
  ["35925511", "Samsung", "SM-A546B", "Galaxy A54 5G"],
  ["35965610", "Samsung", "SM-A135F", "Galaxy A13"],
  ["35965710", "Samsung", "SM-A135F", "Galaxy A13"],
  ["35965810", "Samsung", "SM-A235F", "Galaxy A23"],
  ["35965910", "Samsung", "SM-A235F", "Galaxy A23"],
  ["86891104", "Xiaomi", "Redmi Note 8", "Redmi Note 8"],
  ["86891105", "Xiaomi", "Redmi Note 8 Pro", "Redmi Note 8 Pro"],
  ["86769004", "Xiaomi", "Redmi Note 9", "Redmi Note 9"],
  ["86769104", "Xiaomi", "Redmi Note 9 Pro", "Redmi Note 9 Pro"],
  ["86351504", "Xiaomi", "Redmi 9", "Redmi 9"],
  ["86351604", "Xiaomi", "Redmi 9A", "Redmi 9A"],
  ["86351704", "Xiaomi", "Redmi 9C", "Redmi 9C"],
  ["86873504", "Xiaomi", "Redmi 10", "Redmi 10"],
  ["86873604", "Xiaomi", "Redmi 10C", "Redmi 10C"],
  ["86146004", "Xiaomi", "Redmi Note 11", "Redmi Note 11"],
  ["86146104", "Xiaomi", "Redmi Note 11 Pro", "Redmi Note 11 Pro"],
  ["86407004", "Xiaomi", "Redmi Note 12", "Redmi Note 12"],
  ["86407104", "Xiaomi", "Redmi Note 12 Pro", "Redmi Note 12 Pro"],
  ["86745104", "Xiaomi", "POCO X3", "POCO X3 NFC"],
  ["86745204", "Xiaomi", "POCO X3 Pro", "POCO X3 Pro"],
  ["86817004", "Xiaomi", "POCO F3", "POCO F3"],
  ["86817104", "Xiaomi", "POCO F4", "POCO F4"],
  ["86970604", "Xiaomi", "Redmi 12", "Redmi 12"],
  ["86970704", "Xiaomi", "Redmi 12C", "Redmi 12C"],
  ["35693803", "Google", "G9S9B", "Pixel 6"],
  ["35693804", "Google", "G9S9B", "Pixel 6"],
  ["35261312", "Google", "GP4BC", "Pixel 8 Pro"],
  ["35261412", "Google", "G9BQD", "Pixel 8"],
  ["35428091", "Huawei", "VOG-L29", "Huawei P30 Pro"],
  ["86600003", "Huawei", "LYA-L29", "Huawei Mate 20 Pro"],
];

function rowsToMap(rows: (string | undefined)[][]): Map<string, TacEntry> {
  const map = new Map<string, TacEntry>();
  for (const row of rows) {
    const [tac, brand, model, name] = row;
    if (!tac || !brand || !model) continue;
    map.set(tac, { brand, model, name: name ?? model });
  }
  return map;
}

function getBuiltinIndex(): Map<string, TacEntry> {
  if (!tacIndex) {
    tacIndex = rowsToMap(BUILTIN_TAC_ROWS);
    databaseSize = tacIndex.size;
  }
  return tacIndex;
}

export function normalizeImei(input: string): string {
  return input.replace(/[\s\-_.]/g, "");
}

export function isImeiFormat(imei: string): boolean {
  return /^\d{15}$/.test(imei);
}

export function isValidImeiLuhn(imei: string): boolean {
  if (!isImeiFormat(imei)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = Number(imei[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(imei[14]);
}

export function getReportingBody(imei: string): string {
  const code = imei.slice(0, 2);
  return REPORTING_BODIES[code] ?? `Allocation group ${code}`;
}

export function lookupTac(tac: string): TacEntry | null {
  const index = getBuiltinIndex();
  return index.get(tac) ?? null;
}

export function lookupImei(rawInput: string): ImeiLookupResult | { error: string } {
  const imei = normalizeImei(rawInput);

  if (!imei) {
    return { error: "Enter a 15-digit IMEI number." };
  }

  if (!/^\d+$/.test(imei)) {
    return { error: "IMEI must contain digits only (spaces and dashes are OK)." };
  }

  if (imei.length !== 15) {
    return {
      error: `IMEI must be exactly 15 digits (you entered ${imei.length}).`,
    };
  }

  const luhnValid = isValidImeiLuhn(imei);
  const tac = imei.slice(0, 8);
  const serialNumber = imei.slice(8, 14);
  const checkDigit = imei.slice(14);
  const index = getBuiltinIndex();

  return {
    imei,
    valid: luhnValid,
    luhnValid,
    tac,
    serialNumber,
    checkDigit,
    reportingBody: getReportingBody(imei),
    device: index.get(tac) ?? null,
    databaseLoaded: true,
    databaseSize: index.size,
  };
}

type OsmocomRow = {
  tac?: string;
  manufacturer?: string;
  model?: string;
  name?: string;
  brand?: string;
};

let extendedLoadPromise: Promise<number> | null = null;

/** Optional: merge Osmocom TAC DB fetched in-browser (IMEI never leaves device). */
export async function loadExtendedTacDatabase(): Promise<number> {
  if (extendedLoadPromise) return extendedLoadPromise;

  extendedLoadPromise = (async () => {
    const index = getBuiltinIndex();
    const response = await fetch("/data/tac-osmocom.json");
    if (!response.ok) {
      throw new Error("Extended TAC database is not available on this deployment.");
    }

    const data = (await response.json()) as OsmocomRow[] | Record<string, OsmocomRow>;
    const rows = Array.isArray(data) ? data : Object.values(data);

    for (const row of rows) {
      const tac = row.tac?.replace(/\D/g, "").padStart(8, "0").slice(0, 8);
      if (!tac || tac.length < 8) continue;
      const brand = row.manufacturer ?? row.brand ?? "Unknown";
      const model = row.model ?? row.name ?? "Unknown model";
      const name = row.name ?? model;
      if (!index.has(tac)) {
        index.set(tac, { brand, model, name });
      }
    }

    databaseSize = index.size;
    return databaseSize;
  })();

  return extendedLoadPromise;
}

export function getTacDatabaseSize(): number {
  return databaseSize || getBuiltinIndex().size;
}
