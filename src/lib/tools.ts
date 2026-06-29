import {
  Database,
  ImageIcon,
  Sparkles,
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
