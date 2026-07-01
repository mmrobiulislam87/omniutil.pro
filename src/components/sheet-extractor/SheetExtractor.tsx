"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { absoluteUrl } from "@/lib/site";

function buildBookmarkletCode(): string {
  const hub = absoluteUrl("/sheet-extractor");
  return `javascript:(function(){const images=[];document.querySelectorAll('img, div, md-content').forEach(el=>{const src=el.src||(el.style.backgroundImage&&el.style.backgroundImage.slice(4,-1).replace(/"/g,""));if(src&&(src.match(/\\.(jpeg|jpg|png|webp)/i)||src.startsWith('data:image'))){if(!images.includes(src))images.push(src);}});if(images.length===0){alert('No sheet images detected! Make sure the popup is fully open and visible on screen.');return;}alert('OmniUtil Magic: Found '+images.length+' pages! Redirecting to your secure download hub...');const p=encodeURIComponent(JSON.stringify(images));const hub='${hub}';window.location.href=p.length>1800?hub+'#'+p:hub+'?links='+p;})();`;
}

function parseImageLinks(rawHtml: string): string[] {
  if (!rawHtml.trim()) return [];

  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawHtml)) !== null) {
    const url = match[1];
    if (url.match(/\.(jpeg|jpg|png|webp|gif)/i) || url.startsWith("data:image")) {
      links.push(url);
    }
  }

  return links;
}

function parseIncomingLinks(raw: string): string[] {
  const decoded = decodeURIComponent(raw);
  const parsed: unknown = JSON.parse(decoded);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

function SheetExtractorContent() {
  const searchParams = useSearchParams();
  const bookmarkletCode = useMemo(() => buildBookmarkletCode(), []);

  const [activeTab, setActiveTab] = useState<"bookmarklet" | "parser">(
    "bookmarklet",
  );
  const [htmlInput, setHtmlInput] = useState("");
  const [extractedLinks, setExtractedLinks] = useState<string[]>([]);
  const [bridged, setBridged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linksCopied, setLinksCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    const rawQuery = searchParams.get("links");
    const rawHash =
      typeof window !== "undefined" && window.location.hash.length > 1
        ? window.location.hash.slice(1)
        : null;
    const raw = rawQuery ?? rawHash;
    if (!raw) return;

    try {
      const parsedLinks = parseIncomingLinks(raw);
      if (parsedLinks.length > 0) {
        setExtractedLinks(parsedLinks);
        setActiveTab("parser");
        setBridged(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      /* invalid payload */
    }
  }, [searchParams]);

  const handleParseHtml = (rawHtml: string) => {
    setHtmlInput(rawHtml);
    setBridged(false);
    setExtractedLinks(parseImageLinks(rawHtml));
  };

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const copyExtractedLinks = async () => {
    if (extractedLinks.length === 0) return;
    try {
      await navigator.clipboard.writeText(extractedLinks.join("\n"));
      setLinksCopied(true);
      setTimeout(() => setLinksCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const downloadZip = useCallback(async () => {
    if (extractedLinks.length === 0 || zipping) return;
    setZipping(true);
    setZipError(null);

    try {
      const zip = new JSZip();
      let saved = 0;

      await Promise.all(
        extractedLinks.map(async (url, i) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = url.split(".").pop()?.split("?")[0] || "png";
            zip.file(`sheet_page_${i + 1}.${ext}`, blob);
            saved += 1;
          } catch {
            /* CORS or network — skip */
          }
        }),
      );

      if (saved === 0) {
        setZipError(
          "Could not fetch images for ZIP (site may block cross-origin). Open previews and save manually, or copy URLs.",
        );
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `OmniUtil_Extracted_Sheet_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setZipError("ZIP build failed. Try again or save images from the grid.");
    } finally {
      setZipping(false);
    }
  }, [extractedLinks, zipping]);

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-800">
        <button
          type="button"
          onClick={() => setActiveTab("bookmarklet")}
          className={`border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "bookmarklet"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          📱 Method 1: Hijack & Bridge Bookmarklet
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("parser")}
          className={`border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "parser"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          🔎 Method 2: HTML Source Parser
        </button>
      </div>

      {activeTab === "bookmarklet" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 text-sm text-gray-300">
            <h4 className="flex items-center gap-2 font-bold text-blue-400">
              📱 Hijack & Bridge — মোবাইল ও পিসি গাইড
            </h4>
            <ol className="list-inside list-decimal space-y-1.5 text-xs text-gray-400">
              <li>
                <span className="font-semibold text-gray-200">Copy Magic Code</span>{" "}
                বাটনে ক্লিক করে কোড কপি করুন।
              </li>
              <li>
                বুকমার্ক সেভ করুন নাম:{" "}
                <span className="font-bold text-blue-400">🪄 Extract Sheet</span> —
                URL বক্সে কোড পেস্ট করুন।
              </li>
              <li>
                বিদ্যাবাড়ি/টার্গেট সাইটে যান, লেকচার লিংকে ক্লিক করে{" "}
                <span className="font-semibold text-gray-200">পপ-আপ খুলে</span> সব
                স্লাইড স্ক্রিনে দেখান।
              </li>
              <li>
                Address bar এ <span className="font-bold text-blue-400">Extract Sheet</span>{" "}
                টাইপ করে বুকমার্ক চালান।
              </li>
              <li>
                কোড ছবির লিংক হাইজ্যাক করে{" "}
                <span className="font-semibold text-emerald-400">OmniUtil</span> এ
                রিডাইরেক্ট করবে — সেখানে গ্রিড প্রিভিউ ও ZIP ডাউনলোড। কোনো
                এক্সটার্নাল স্ক্রিপ্ট লোড হয় না (CSP-safe)।
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#0B0F19] p-4 md:flex-row">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                OmniUtil Bridge Injector (no external scripts)
              </span>
              <p className="max-w-md truncate font-mono text-xs text-gray-500 md:max-w-xl">
                {bookmarkletCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyBookmarklet()}
              className={`w-full rounded-xl border px-5 py-2.5 text-xs font-bold transition md:w-auto ${
                copied
                  ? "border-emerald-500/30 bg-emerald-600/10 text-emerald-400"
                  : "border-transparent bg-blue-600 text-white shadow-lg shadow-blue-900/20 hover:bg-blue-700"
              }`}
            >
              {copied ? "✓ Copied!" : "Copy Magic Code"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "parser" && (
        <div className="space-y-4">
          {bridged && extractedLinks.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-300">
              ✓ Bridge successful — {extractedLinks.length} sheet page
              {extractedLinks.length === 1 ? "" : "s"} received from the target site.
            </div>
          )}

          {!bridged && (
            <div className="flex flex-col space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Paste HTML Source (Ctrl + U Code)
              </span>
              <textarea
                value={htmlInput}
                onChange={(e) => handleParseHtml(e.target.value)}
                placeholder="Paste the webpage HTML source code here to extract asset links..."
                className="h-48 w-full resize-none rounded-xl border border-gray-800 bg-[#0B0F19] p-4 font-mono text-sm text-gray-300 placeholder-gray-600 focus:border-blue-500/50 focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Extracted Assets ({extractedLinks.length})
              </span>
              {extractedLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyExtractedLinks()}
                    className="rounded-lg border border-gray-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 transition hover:border-emerald-500/40 hover:text-emerald-400"
                  >
                    {linksCopied ? "✓ Copied URLs" : "Copy all URLs"}
                  </button>
                  <button
                    type="button"
                    disabled={zipping}
                    onClick={() => void downloadZip()}
                    className="rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 transition hover:bg-blue-600/30 disabled:opacity-50"
                  >
                    {zipping ? "Building ZIP…" : "Download ZIP"}
                  </button>
                </div>
              )}
            </div>

            {zipError && (
              <p className="text-xs text-amber-400" role="alert">
                {zipError}
              </p>
            )}

            <div className="relative min-h-32 w-full overflow-hidden rounded-xl border border-gray-800 bg-[#0B0F19]">
              <ToolStateWrapper
                isEmpty={extractedLinks.length === 0}
                emptyMessage={
                  bridged
                    ? "Waiting for bridged links…"
                    : "No asset links yet. Run the bookmarklet or paste HTML above."
                }
              >
                <div className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4">
                  {extractedLinks.map((link, idx) => (
                    <a
                      key={`${idx}-${link.slice(0, 48)}`}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 transition hover:border-emerald-500/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={link}
                        alt={`Sheet page ${idx + 1}`}
                        className="aspect-[3/4] w-full object-cover object-top"
                        loading="lazy"
                      />
                      <p className="truncate p-2 font-mono text-[10px] text-emerald-400">
                        Page {idx + 1}
                      </p>
                    </a>
                  ))}
                </div>
              </ToolStateWrapper>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SheetExtractor() {
  return <SheetExtractorContent />;
}
