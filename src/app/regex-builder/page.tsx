import ToolLayout from "@/components/ToolLayout";
import { RegexBuilder } from "@/components/regex-builder/RegexBuilder";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("regex-builder")!;

export const metadata = buildToolMetadata(tool);

export default function RegexBuilderPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
    >
      <RegexBuilder />
    </ToolLayout>
  );
}
