import ToolLayout from "@/components/ToolLayout";
import { JsonFormatter } from "@/components/json-formatter/JsonFormatter";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("json-formatter")!;

export const metadata = buildToolMetadata(tool);

export default function JsonFormatterPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
    >
      <JsonFormatter />
    </ToolLayout>
  );
}
