import ToolLayout from "@/components/ToolLayout";
import { DataSanitizer } from "@/components/data-sanitizer/DataSanitizer";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("data-sanitizer")!;

export const metadata = buildToolMetadata(tool);

export default function DataSanitizerPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
    >
      <DataSanitizer />
    </ToolLayout>
  );
}
