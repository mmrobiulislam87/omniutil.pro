export type JwtPart = {
  raw: string;
  json: unknown;
  pretty: string;
  error?: string;
};

export type JwtDecodeResult = {
  header: JwtPart;
  payload: JwtPart;
  signature: string;
  algorithm: string | null;
  isValidStructure: boolean;
};

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const base64 = padded + (pad ? "=".repeat(4 - pad) : "");
  return decodeURIComponent(
    Array.from(atob(base64), (c) =>
      "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join(""),
  );
}

function parsePart(segment: string): JwtPart {
  try {
    const raw = base64UrlDecode(segment);
    const json = JSON.parse(raw) as unknown;
    return {
      raw,
      json,
      pretty: JSON.stringify(json, null, 2),
    };
  } catch (err) {
    return {
      raw: "",
      json: null,
      pretty: "",
      error: err instanceof Error ? err.message : "Failed to decode segment.",
    };
  }
}

export function decodeJwt(token: string): JwtDecodeResult | { error: string } {
  const trimmed = token.trim().replace(/^Bearer\s+/i, "");
  if (!trimmed) return { error: "Paste a JWT token to decode." };

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return {
      error: `JWT must have 3 parts separated by dots (found ${parts.length}).`,
    };
  }

  const [headerSeg, payloadSeg, signature] = parts;
  const header = parsePart(headerSeg);
  const payload = parsePart(payloadSeg);

  const algorithm =
    header.json &&
    typeof header.json === "object" &&
    header.json !== null &&
    "alg" in header.json
      ? String((header.json as { alg: unknown }).alg)
      : null;

  return {
    header,
    payload,
    signature,
    algorithm,
    isValidStructure: !header.error && !payload.error,
  };
}

export async function verifyJwtHs256(
  token: string,
  secret: string,
): Promise<{ valid: boolean; error?: string }> {
  const trimmed = token.trim().replace(/^Bearer\s+/i, "");
  const parts = trimmed.split(".");
  if (parts.length !== 3) return { valid: false, error: "Invalid JWT structure." };

  const [headerSeg, payloadSeg, signatureB64] = parts;
  const data = `${headerSeg}.${payloadSeg}`;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return { valid: computed === signatureB64 };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Verification failed.",
    };
  }
}
