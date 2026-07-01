"use client";

import { useState } from "react";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";

const BOOKMARKLET_CODE = `javascript:(function(){const imgs=Array.from(document.querySelectorAll('img')).map(img=>img.src).filter(src=>src.match(/\\.(jpeg|jpg|gif|png|webp)/i)||src.startsWith('data:image'));if(imgs.length===0){alert('No images found on this page! Make sure to scroll down.');return;}alert('OmniUtil Magic: Found '+imgs.length+' images. Loading compiler...');const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';script.onload=function(){const zip=new JSZip();let completed=0;imgs.forEach((url,i)=>{fetch(url).then(res=>res.blob()).then(blob=>{const ext=url.split('.').pop().split('?')[0]||'png';zip.file('sheet_page_'+(i+1)+'.'+ext,blob);}).catch(()=>console.log('Skipped image due to security')).finally(()=>{completed++;if(completed===imgs.length){zip.generateAsync({type:'blob'}).then(content=>{const a=document.createElement('a');a.href=URL.createObjectURL(content);a.download='OmniUtil_Extracted_Sheet.zip';a.click();});}});});};document.head.appendChild(script);})();`;

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

export function SheetExtractor() {
  const [activeTab, setActiveTab] = useState<"bookmarklet" | "parser">(
    "bookmarklet",
  );
  const [htmlInput, setHtmlInput] = useState("");
  const [extractedLinks, setExtractedLinks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [linksCopied, setLinksCopied] = useState(false);

  const handleParseHtml = (rawHtml: string) => {
    setHtmlInput(rawHtml);
    setExtractedLinks(parseImageLinks(rawHtml));
  };

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_CODE);
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
          📱 Method 1: Magic Bookmarklet (Best for Mobile & PC)
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
              📱 মোবাইল ইউজারদের ম্যাজিক ট্রিক (How to Use on Phone):
            </h4>
            <ol className="list-inside list-decimal space-y-1.5 text-xs text-gray-400">
              <li>
                নিচের{" "}
                <span className="font-semibold text-gray-200">
                  Copy Magic Code
                </span>{" "}
                বাটনে ক্লিক করে কোডটি কপি করুন।
              </li>
              <li>
                আপনার ব্রাউজারে যেকোনো একটি পেজকে বুকমার্ক হিসেবে সেভ করুন এবং
                সেটির নাম দিন:{" "}
                <span className="font-bold text-blue-400">🪄 Extract Sheet</span>
              </li>
              <li>
                বুকমার্কটি এডিট করে তার URL বক্সে থাকা আগের লিংক মুছে ওমনিইউটিলের
                এই কপি করা কোডটি পেস্ট করে দিন।
              </li>
              <li>
                এবার বিদ্যাবাড়ি বা আপনার টার্গেট লেকচার পেজে যান, স্ক্রোল করে সব
                ইমেজ লোড করুন।
              </li>
              <li>
                ব্রাউজারের উপরের{" "}
                <span className="font-semibold text-gray-200">Address Bar</span> এ
                গিয়ে টাইপ করুন{" "}
                <span className="font-bold text-blue-400">Extract Sheet</span> এবং
                নিচে ভেসে ওঠা বুকমার্কটিতে ক্লিক করুন। ব্যস, জিপ ফাইল অটো
                ডাউনলোড!
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#0B0F19] p-4 md:flex-row">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                OmniUtil Injector Core
              </span>
              <p className="max-w-md truncate font-mono text-xs text-gray-500 md:max-w-xl">
                {BOOKMARKLET_CODE}
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Extracted Assets ({extractedLinks.length})
              </span>
              {extractedLinks.length > 0 && (
                <button
                  type="button"
                  onClick={() => void copyExtractedLinks()}
                  className="rounded-lg border border-gray-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 transition hover:border-emerald-500/40 hover:text-emerald-400"
                >
                  {linksCopied ? "✓ Copied URLs" : "Copy all URLs"}
                </button>
              )}
            </div>
            <div className="relative min-h-32 w-full overflow-hidden rounded-xl border border-gray-800 bg-[#0B0F19]">
              <ToolStateWrapper
                isEmpty={extractedLinks.length === 0}
                emptyMessage="No asset links extracted yet. Paste HTML above."
              >
                <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
                  {extractedLinks.map((link, idx) => (
                    <a
                      key={`${idx}-${link.slice(0, 48)}`}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-2 font-mono text-xs text-emerald-400 transition hover:bg-emerald-950/30"
                    >
                      📄 Page {idx + 1}: {link}
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
