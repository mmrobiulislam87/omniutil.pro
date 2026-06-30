"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, KeyRound, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import {
  decodeJwt,
  verifyJwtHs256,
  type JwtDecodeResult,
} from "@/utils/jwtDebugger";

function JwtBlock({
  title,
  color,
  content,
  error,
}: {
  title: string;
  color: "rose" | "violet" | "amber";
  content: string;
  error?: string;
}) {
  const colors = {
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  };

  return (
    <div className="space-y-2">
      <p
        className={cn(
          "inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
          colors[color],
        )}
      >
        {title}
      </p>
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <pre className="max-h-56 overflow-auto rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-xs leading-relaxed text-gray-300">
          {content || "{}"}
        </pre>
      )}
    </div>
  );
}

export function JwtDebugger() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<JwtDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runDecode = useCallback((value: string) => {
    setToken(value);
    setVerifyStatus("idle");
    setVerifyError(null);
    const decoded = decodeJwt(value);
    if ("error" in decoded) {
      setError(decoded.error);
      setResult(null);
      return;
    }
    setError(null);
    setResult(decoded);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!token || !secret) return;
    setVerifyStatus("checking");
    setVerifyError(null);
    const res = await verifyJwtHs256(token, secret);
    if (res.error) {
      setVerifyError(res.error);
      setVerifyStatus("invalid");
      return;
    }
    setVerifyStatus(res.valid ? "valid" : "invalid");
  }, [secret, token]);

  const canVerifyHs256 = result?.algorithm === "HS256";

  const tokenParts = useMemo(() => {
    const t = token.trim().replace(/^Bearer\s+/i, "");
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    return parts;
  }, [token]);

  const copyPayload = useCallback(async () => {
    if (!result?.payload.pretty) return;
    await navigator.clipboard.writeText(result.payload.pretty);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-gray-300">
        <p className="font-medium text-amber-300">Web Crypto API · offline decode</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Decode JWT header and payload locally. Optional HS256 signature
          verification uses Web Crypto — your secret never leaves the browser.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Encoded JWT
        </label>
        <textarea
          value={token}
          onChange={(e) => runDecode(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          spellCheck={false}
          className="min-h-28 w-full resize-y rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
        />
        {tokenParts && (
          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">
              {tokenParts[0].slice(0, 12)}…
            </span>
            <span className="text-gray-600">.</span>
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">
              {tokenParts[1].slice(0, 12)}…
            </span>
            <span className="text-gray-600">.</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
              {tokenParts[2].slice(0, 12)}…
            </span>
          </div>
        )}
      </div>

      {error && <ToolErrorBanner title="Invalid JWT" message={error} />}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              Algorithm:{" "}
              <span className="font-mono text-gray-300">
                {result.algorithm ?? "unknown"}
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={copyPayload}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy payload
            </Button>
          </div>

          <JwtBlock
            title="Header"
            color="rose"
            content={result.header.pretty}
            error={result.header.error}
          />
          <JwtBlock
            title="Payload"
            color="violet"
            content={result.payload.pretty}
            error={result.payload.error}
          />
          <JwtBlock
            title="Signature"
            color="amber"
            content={result.signature}
          />

          {canVerifyHs256 && (
            <div className="rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4 space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <KeyRound className="h-3.5 w-3.5" />
                Verify HS256 signature
              </p>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="HMAC secret"
                className="w-full rounded-lg border border-gray-800 bg-[#0B0F19] px-3 py-2 font-mono text-sm text-gray-200 focus:border-amber-500/50 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={handleVerify} disabled={!secret}>
                  Verify signature
                </Button>
                {verifyStatus === "valid" && (
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <ShieldCheck className="h-4 w-4" /> Signature valid
                  </span>
                )}
                {verifyStatus === "invalid" && !verifyError && (
                  <span className="flex items-center gap-1 text-sm text-red-400">
                    <ShieldX className="h-4 w-4" /> Signature invalid
                  </span>
                )}
              </div>
              {verifyError && (
                <p className="text-xs text-red-400">{verifyError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
