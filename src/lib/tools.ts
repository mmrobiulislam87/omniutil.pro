import {
  Braces,
  Database,
  Eraser,
  FileText,
  ImageIcon,
  Images,
  KeyRound,
  Mic,
  PenTool,
  Regex,
  Smartphone,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

export type Tool = {
  id: string;
  name: string;
  dashboardTitle: string;
  description: string;
  href: string;
  icon: LucideIcon;
  emoji: string;
  badge: string;
  category: string;
  tags: string[];
};

export const TOOLS: Tool[] = [
  {
    id: "screen-recorder",
    name: "Screen Recorder",
    dashboardTitle: "ProStudio Screen Recorder",
    description:
      "Record up to 1440p @ 60fps, then edit in ProStudio — multi-clip cut, 9:16 Shorts export, audio clean, watermark, and smart presets for Discord & email. 100% in-browser.",
    href: "/screen-recorder",
    icon: Video,
    emoji: "🎬",
    badge: "Pro Studio",
    category: "Media",
    tags: [
      "screen recorder",
      "screen capture",
      "loom alternative",
      "video trim",
      "webcam",
      "demo",
      "presentation",
      "ffmpeg",
      "wasm",
      "privacy",
      "no watermark",
    ],
  },
  {
    id: "audio-transcriber",
    name: "Audio Transcriber",
    dashboardTitle: "WASM Local Transcriber",
    description:
      "Transcribe audio to text with OpenAI Whisper running entirely in your browser. ONNX/WASM powered — your recordings never leave your device.",
    href: "/audio-transcriber",
    icon: Mic,
    emoji: "🎙️",
    badge: "Whisper / WASM",
    category: "AI",
    tags: [
      "whisper",
      "transcribe",
      "speech to text",
      "audio",
      "wasm",
      "onnx",
      "ai",
      "privacy",
    ],
  },
  {
    id: "regex-builder",
    name: "Regex Builder",
    dashboardTitle: "Visual Regex Builder",
    description:
      "Build, test, and debug regular expressions with live match highlighting and capture group details. 100% client-side pure JavaScript.",
    href: "/regex-builder",
    icon: Regex,
    emoji: "🔍",
    badge: "Dev Utility",
    category: "Dev",
    tags: [
      "regex",
      "regular expression",
      "pattern",
      "matcher",
      "developer",
      "test",
      "debug",
    ],
  },
  {
    id: "jwt-debugger",
    name: "JWT Debugger",
    dashboardTitle: "Secure JWT & Crypto Debugger",
    description:
      "Decode and inspect JWT tokens with color-coded header, payload, and signature. Verify HS256 signatures offline with Web Crypto API.",
    href: "/jwt-debugger",
    icon: KeyRound,
    emoji: "🔐",
    badge: "Web Crypto",
    category: "Security",
    tags: [
      "jwt",
      "token",
      "decode",
      "web crypto",
      "hs256",
      "oauth",
      "developer",
      "security",
    ],
  },
  {
    id: "svg-to-code",
    name: "SVG to Code",
    dashboardTitle: "SVG-to-Code Transformer",
    description:
      "Optimize SVGs with SVGO and generate React or Tailwind TSX components instantly. Live preview, one-click copy — 100% client-side.",
    href: "/svg-to-code",
    icon: PenTool,
    emoji: "🎨",
    badge: "SVGO / Dev",
    category: "Dev",
    tags: [
      "svg",
      "react",
      "tailwind",
      "svgo",
      "icon",
      "tsx",
      "frontend",
      "designer",
      "convert",
    ],
  },
  {
    id: "imei-checker",
    name: "IMEI Checker",
    dashboardTitle: "IMEI Checker & Device Lookup",
    description:
      "Validate IMEI numbers and identify phone brand and model from the TAC code. 100% private — your IMEI never leaves your browser.",
    href: "/imei-checker",
    icon: Smartphone,
    emoji: "📱",
    badge: "Privacy-First",
    category: "Utility",
    tags: [
      "imei",
      "imei checker",
      "tac",
      "phone model",
      "device lookup",
      "serial",
      "mobile",
      "validator",
    ],
  },
  {
    id: "json-formatter",
    name: "JSON Formatter",
    dashboardTitle: "JSON Formatter & Validator",
    description:
      "Clean, format, minify, and validate JSON data instantly. Detect syntax errors with line numbers locally in your browser.",
    href: "/json-formatter",
    icon: Braces,
    emoji: "📦",
    badge: "Dev Utility",
    category: "Dev",
    tags: [
      "json",
      "formatter",
      "validator",
      "beautify",
      "minify",
      "syntax",
      "developer",
      "api",
    ],
  },
  {
    id: "bg-remover",
    name: "AI Background Remover",
    dashboardTitle: "AI Background Remover",
    description:
      "Remove image backgrounds instantly and perfectly right inside your browser. 100% private, zero uploads, with custom color insertion.",
    href: "/bg-remover",
    icon: Eraser,
    emoji: "🖼️",
    badge: "AI / WASM",
    category: "Media",
    tags: [
      "background remover",
      "remove bg",
      "transparent png",
      "ecommerce",
      "product photo",
      "onnx",
      "wasm",
      "ai",
      "privacy",
    ],
  },
  {
    id: "media-optimizer",
    name: "Media Optimizer",
    dashboardTitle: "WASM Media Optimizer",
    description:
      "Compress and convert images to WebP/AVIF locally inside your browser using WebAssembly. No file uploads.",
    href: "/media-optimizer",
    icon: ImageIcon,
    emoji: "⚡",
    badge: "WASM / Client-side",
    category: "Media",
    tags: ["image", "webp", "avif", "compress", "wasm", "optimize"],
  },
  {
    id: "prompt-architect",
    name: "Prompt Architect",
    dashboardTitle: "AI Prompt Architect",
    description:
      "Transform simple text into master-level AI prompts using CO-STAR, RISEN, RTCE & APE frameworks with a curated template library.",
    href: "/prompt-architect",
    icon: Sparkles,
    emoji: "🧠",
    badge: "AI Utility",
    category: "AI",
    tags: ["prompt", "ai", "costar", "risen", "rtce", "ape", "llm", "chatgpt", "claude"],
  },
  {
    id: "data-sanitizer",
    name: "Data Sanitizer",
    dashboardTitle: "No-Code Data Sanitizer",
    description:
      "Clean, deduplicate, validate, and anonymize CSV and Excel sheets instantly without compromising data privacy.",
    href: "/data-sanitizer",
    icon: Database,
    emoji: "📊",
    badge: "Privacy-First",
    category: "Data",
    tags: ["csv", "excel", "clean", "dedupe", "validate", "sanitize"],
  },
  {
    id: "sheet-extractor",
    name: "Sheet Extractor",
    dashboardTitle: "Web Sheet & Image Extractor",
    description:
      "Extract locked canvas lecture sheets, presentation slides, and images from e-learning platforms. Canvas-to-pixel capture with CSP-safe bridge to OmniUtil for ZIP download.",
    href: "/sheet-extractor",
    icon: Images,
    emoji: "🪄",
    badge: "v1.3 Iframe Shield",
    category: "Utility",
    tags: [
      "sheet extractor",
      "image extractor",
      "bookmarklet",
      "e-learning",
      "lecture",
      "zip download",
      "html parser",
      "canvas",
      "pdf viewer",
      "privacy",
      "mobile",
    ],
  },
  {
    id: "file-to-pdf",
    name: "File to PDF",
    dashboardTitle: "Universal File to PDF",
    description:
      "Convert images, Excel, CSV, and text files into a beautiful PDF instantly — full বাংলা and multilingual Unicode support. 100% client-side.",
    href: "/file-to-pdf",
    icon: FileText,
    emoji: "📄",
    badge: "Unicode / Client-side",
    category: "Document",
    tags: [
      "pdf",
      "convert",
      "image to pdf",
      "excel to pdf",
      "bengali pdf",
      "unicode",
      "merge images",
      "document",
    ],
  },
];

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function filterTools(query: string): Tool[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return TOOLS;

  return TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(normalized) ||
      tool.dashboardTitle.toLowerCase().includes(normalized) ||
      tool.description.toLowerCase().includes(normalized) ||
      tool.category.toLowerCase().includes(normalized) ||
      tool.tags.some((tag) => tag.includes(normalized)),
  );
}

export function buildToolMetadata(tool: Tool): Metadata {
  return {
    title: tool.name,
    description: tool.description,
    keywords: tool.tags,
    openGraph: {
      title: `${tool.dashboardTitle} | OmniUtil.pro`,
      description: tool.description,
    },
    twitter: {
      title: tool.dashboardTitle,
      description: tool.description,
    },
  };
}
