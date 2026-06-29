import ToolLayout from "@/components/ToolLayout";
import { FileToPdf } from "@/components/file-to-pdf/FileToPdf";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("file-to-pdf")!;

export const metadata = buildToolMetadata(tool);

export default function FileToPdfPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
    >
      <FileToPdf />
    </ToolLayout>
  );
}
