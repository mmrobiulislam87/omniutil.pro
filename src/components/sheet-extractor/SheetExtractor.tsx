"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { absoluteUrl, siteConfig } from "@/lib/site";

const HUB_ORIGIN = new URL(siteConfig.url).origin;

function buildBookmarkletCode(): string {
  const hub = absoluteUrl("/sheet-extractor");
  return `javascript:(function(){const hub='${hub}';const origin='${HUB_ORIGIN}';let xOrigin=false;function vis(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}function bigC(c){const r=c.getBoundingClientRect();return(r.width>300||c.width>300)&&(r.height>100||c.height>100);}function inModal(el){try{return!!el.closest('.modal-content,.modal.show,.modal.in,[role="dialog"],#pdf-container,[class*="modal"],[class*="popup"]');}catch(e){return false;}}function getCanvas(d){try{return Array.from(d.querySelectorAll('canvas.page,canvas')).filter(c=>bigC(c)&&vis(c));}catch(e){return[];}}let targets=getCanvas(document);document.querySelectorAll('iframe').forEach(f=>{try{const d=f.contentDocument||f.contentWindow.document;if(d)targets=targets.concat(getCanvas(d));}catch(e){xOrigin=true;}});let modalT=targets.filter(inModal);if(modalT.length)targets=modalT;function pickSrc(){let best='',sc=-1;document.querySelectorAll('iframe').forEach(f=>{const s=f.src||'';if(!s||s.startsWith('about:'))return;let n=(inModal(f)?5:0)+(/viewer|pdf|document|slide|sheet/i.test(s)?3:0)+(f.offsetWidth>300?1:0);if(n>sc){sc=n;best=s;}});return best;}if(!targets.length&&xOrigin){const s=pickSrc();if(s){alert('🔒 Secure Document Viewer in iframe!\\n\\nOpening direct viewer in new tab. Scroll to load all pages, then run Extract Sheet again on that tab.');window.open(s,'_blank');return;}}if(!targets.length){alert('No canvas sheets found. Scroll to load pages — or run tab-hop first if popup uses a secure iframe.');return;}let items;try{items=targets.map(c=>c.toDataURL('image/png'));}catch(e){alert('Canvas capture blocked. Scroll pages into view.');return;}alert('OmniUtil v1.3: '+items.length+' sheet page(s) captured.');function send(imgs){const enc=encodeURIComponent(JSON.stringify(imgs));if(enc.length<900000){window.location.href=enc.length>1800?hub+'#data='+enc:hub+'?data='+enc;return;}alert('OmniUtil Bridge: transferring...');const w=window.open(hub+'?bridge=1','_blank');if(!w){alert('Allow popups.');return;}let n=0;const t=setInterval(()=>{n++;if(n>15){clearInterval(t);return;}try{w.postMessage({source:'omniutil-extractor',images:imgs},origin);}catch(e){}},800);const ack=e=>{if(e.data==='omniutil-acknowledged'){clearInterval(t);window.removeEventListener('message',ack);}};window.addEventListener('message',ack);}send(items);})();`;
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

function normalizePayloadRaw(raw: string): string {
  if (raw.startsWith("data=")) return raw.slice(5);
  if (raw.startsWith("links=")) return raw.slice(6);
  return raw;
}

function parseIncomingPayload(raw: string): string[] {
  const decoded = decodeURIComponent(normalizePayloadRaw(raw));
  const parsed: unknown = JSON.parse(decoded);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

function ingestPayload(
  raw: string,
  apply: (links: string[]) => void,
): boolean {
  try {
    const parsed = parseIncomingPayload(raw);
    if (parsed.length === 0) return false;
    apply(parsed);
    window.history.replaceState(null, "", window.location.pathname);
    return true;
  } catch {
    return false;
  }
}

function isDataImage(src: string): boolean {
  return src.startsWith("data:image");
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
  const [canvasMode, setCanvasMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linksCopied, setLinksCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [bridgeWaiting, setBridgeWaiting] = useState(false);

  const applyExtracted = useCallback((links: string[]) => {
    setExtractedLinks(links);
    setActiveTab("parser");
    setBridged(true);
    setCanvasMode(links.length > 0 && links.every(isDataImage));
  }, []);

  useEffect(() => {
    const rawQuery =
      searchParams.get("data") ?? searchParams.get("links") ?? null;
    const rawHash =
      typeof window !== "undefined" && window.location.hash.length > 1
        ? window.location.hash.slice(1)
        : null;
    const raw = rawQuery ?? rawHash;
    if (raw) ingestPayload(raw, applyExtracted);
  }, [searchParams, applyExtracted]);

  useEffect(() => {
    if (searchParams.get("bridge") !== "1") return;

    setBridgeWaiting(true);
    setActiveTab("parser");
    setBridged(true);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        source?: string;
        images?: unknown;
      };
      const isLegacy = data?.type === "omniutil-sheet-extract";
      const isV12 = data?.source === "omniutil-extractor";
      if (!isLegacy && !isV12) return;
      if (!Array.isArray(data.images)) return;

      const images = data.images.filter(
        (item): item is string => typeof item === "string",
      );
      if (images.length === 0) return;

      applyExtracted(images);
      setBridgeWaiting(false);
      window.history.replaceState(null, "", window.location.pathname);

      try {
        const source = event.source as Window | null;
        source?.postMessage("omniutil-acknowledged", event.origin);
      } catch {
        /* ack failed */
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [searchParams, applyExtracted]);

  const handleParseHtml = (rawHtml: string) => {
    setHtmlInput(rawHtml);
    setBridged(false);
    setCanvasMode(false);
    setBridgeWaiting(false);
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
      const text = canvasMode
        ? `${extractedLinks.length} canvas pages captured (data URLs — use Download ZIP)`
        : extractedLinks.join("\n");
      await navigator.clipboard.writeText(text);
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
        extractedLinks.map(async (src, i) => {
          try {
            if (isDataImage(src)) {
              const base64 = src.split(",")[1];
              const ext =
                src.match(/data:image\/([^;]+)/)?.[1]?.replace("jpeg", "jpg") ??
                "png";
              zip.file(`sheet_page_${i + 1}.${ext}`, base64, { base64: true });
              saved += 1;
              return;
            }

            const res = await fetch(src);
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = src.split(".").pop()?.split("?")[0] || "png";
            zip.file(`sheet_page_${i + 1}.${ext}`, blob);
            saved += 1;
          } catch {
            /* CORS or network — skip */
          }
        }),
      );

      if (saved === 0) {
        setZipError(
          canvasMode
            ? "ZIP build failed. Try again."
            : "Could not fetch images for ZIP (site may block cross-origin). Use canvas bookmarklet or save from grid.",
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
  }, [extractedLinks, zipping, canvasMode]);

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
          📱 Method 1: Iframe Breaker Bookmarklet (v1.3)
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
          <div className="space-y-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-gray-300">
            <h4 className="flex items-center gap-2 font-bold text-emerald-400">
              🛡️ v1.3 Iframe Breaker — Tab-Hop গাইড
            </h4>
            <p className="text-xs text-gray-400">
              বিদ্যাবাড়ির PDF viewer cross-origin iframe-এ লক থাকলে সরাসরি canvas
              পড়া যায় না। v1.3 সেই ক্ষেত্রে viewer-কে নতুন ট্যাবে খুলে দেয়।
            </p>
            <ol className="list-inside list-decimal space-y-1.5 text-xs text-gray-400">
              <li>
                <span className="font-semibold text-emerald-400">v1.3 কোড</span> কপি
                করে বুকমার্ক আপডেট করুন।
              </li>
              <li>
                বিদ্যাবাড়ি <span className="font-semibold text-gray-200">পপ-আপ</span>{" "}
                খুলে বুকমার্ক ১ম বার চালান → secure iframe থাকলে{" "}
                <span className="text-blue-400">নতুন ট্যাব</span> ওপেন হবে।
              </li>
              <li>
                নতুন ট্যাবে স্ক্রোল করে সব পেজ লোড করুন, তারপর বুকমার্ক{" "}
                <span className="font-bold text-blue-400">২য় বার</span> চালান।
              </li>
              <li>
                শুধু <span className="text-emerald-400">canvas</span> ক্যাপচার —
                লোগো, প্রোফাইল, PDF placeholder আইকন আর ফলব্যাক হবে না।
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#0B0F19] p-4 md:flex-row">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-400">
                OmniUtil Ultimate Core v1.3
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
              {copied ? "✓ Copied!" : "Copy Updated Code"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "parser" && (
        <div className="space-y-4">
          {bridgeWaiting && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-sm text-blue-300">
              Waiting for bridged canvas data from the target tab…
            </div>
          )}

          {bridged && extractedLinks.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-300">
              ✓ Bridge successful — {extractedLinks.length}{" "}
              {canvasMode ? "canvas page(s)" : "asset link(s)"} received.
              {canvasMode && " ZIP download works without CORS limits."}
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
                    {linksCopied ? "✓ Copied" : canvasMode ? "Copy info" : "Copy all URLs"}
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
                isEmpty={extractedLinks.length === 0 && !bridgeWaiting}
                emptyMessage={
                  bridgeWaiting
                    ? "Listening for large canvas export…"
                    : "No assets yet. Run the bookmarklet or paste HTML above."
                }
              >
                <div className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4">
                  {extractedLinks.map((link, idx) => {
                    const card = (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={link}
                          alt={`Sheet page ${idx + 1}`}
                          className="aspect-[3/4] w-full object-cover object-top"
                          loading="lazy"
                        />
                        <p className="truncate p-2 font-mono text-[10px] text-emerald-400">
                          Page {idx + 1}
                          {canvasMode ? " · canvas" : ""}
                        </p>
                      </>
                    );
                    const className =
                      "group overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 transition hover:border-emerald-500/40";

                    if (isDataImage(link)) {
                      return (
                        <div key={`${idx}-${link.slice(0, 48)}`} className={className}>
                          {card}
                        </div>
                      );
                    }

                    return (
                      <a
                        key={`${idx}-${link.slice(0, 48)}`}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className={className}
                      >
                        {card}
                      </a>
                    );
                  })}
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
