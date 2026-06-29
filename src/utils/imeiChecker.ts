export type DeviceInfo = {
  brand: string;
  model: string;
  name: string;
  altNames?: string[];
  imageUrl?: string | null;
  gsmarena?: string | null;
  chipset?: string;
  year?: string;
  os?: string;
  network?: string;
  display?: string;
  battery?: string;
  storage?: string;
  camera?: string;
};

export type ImeiLookupResult = {
  imei: string;
  valid: boolean;
  luhnValid: boolean;
  tac: string;
  serialNumber: string;
  checkDigit: string;
  reportingBody: string;
  device: DeviceInfo | null;
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

let tacIndex: Map<string, DeviceInfo> | null = null;
let databaseSize = 0;
let loadPromise: Promise<number> | null = null;

function gsmarenaImageFromPage(url: string): string | null {
  const match = url.match(/gsmarena\.com\/([a-z0-9_]+)-\d+\.php/i);
  if (!match) return null;
  return `https://fdn2.gsmarena.com/vv/bigpic/${match[1].replace(/_/g, "-")}.jpg`;
}

function enrichDevice(raw: DeviceInfo): DeviceInfo {
  const imageUrl =
    raw.imageUrl ??
    (raw.gsmarena ? gsmarenaImageFromPage(raw.gsmarena) : null) ??
    null;
  return { ...raw, imageUrl };
}

export async function ensureTacDatabase(
  onProgress?: (message: string) => void,
): Promise<number> {
  if (tacIndex) return tacIndex.size;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.("Loading device database…");
    const response = await fetch("/data/tac-index.json");
    if (!response.ok) {
      throw new Error("Device database could not be loaded.");
    }

    const data = (await response.json()) as Record<string, DeviceInfo>;
    tacIndex = new Map();
    for (const [tac, info] of Object.entries(data)) {
      tacIndex.set(tac, enrichDevice(info));
    }
    databaseSize = tacIndex.size;
    onProgress?.(`Database ready — ${databaseSize.toLocaleString()} devices`);
    return databaseSize;
  })();

  return loadPromise;
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

export function getTacDatabaseSize(): number {
  return databaseSize;
}

export async function lookupImei(
  rawInput: string,
): Promise<ImeiLookupResult | { error: string }> {
  await ensureTacDatabase();

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
  const device = tacIndex?.get(tac) ?? null;

  return {
    imei,
    valid: luhnValid,
    luhnValid,
    tac,
    serialNumber,
    checkDigit,
    reportingBody: getReportingBody(imei),
    device,
    databaseSize: tacIndex?.size ?? 0,
  };
}

export function getDeviceSpecRows(
  device: DeviceInfo,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Brand", value: device.brand },
    { label: "Model", value: device.model },
    { label: "Marketing name", value: device.name },
  ];

  if (device.chipset) rows.push({ label: "Chipset", value: device.chipset });
  if (device.year) rows.push({ label: "Release year", value: device.year });
  if (device.os) rows.push({ label: "Operating system", value: device.os });
  if (device.network) rows.push({ label: "Network", value: device.network });
  if (device.display) rows.push({ label: "Display", value: device.display });
  if (device.battery) rows.push({ label: "Battery", value: device.battery });
  if (device.storage) rows.push({ label: "Storage", value: device.storage });
  if (device.camera) rows.push({ label: "Camera", value: device.camera });
  if (device.altNames?.length) {
    rows.push({ label: "Also known as", value: device.altNames.join(", ") });
  }

  return rows;
}
