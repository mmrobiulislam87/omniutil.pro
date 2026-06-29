import ToolLayout from "@/components/ToolLayout";
import { ImeiChecker } from "@/components/imei-checker/ImeiChecker";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("imei-checker")!;

export const metadata = buildToolMetadata(tool);

export default function ImeiCheckerPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <ImeiChecker />
    </ToolLayout>
  );
}
