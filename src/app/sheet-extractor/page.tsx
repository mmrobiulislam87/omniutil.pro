import { Suspense } from "react";
import ToolLayout from "@/components/ToolLayout";
import { SheetExtractor } from "@/components/sheet-extractor/SheetExtractor";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("sheet-extractor")!;

export const metadata = buildToolMetadata(tool);

export default function SheetExtractorPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <Suspense
        fallback={
          <p className="text-sm text-gray-500">Loading sheet extractor…</p>
        }
      >
        <SheetExtractor />
      </Suspense>
    </ToolLayout>
  );
}
