import ToolLayout from "@/components/ToolLayout";
import { PromptArchitect } from "@/components/prompt-architect/PromptArchitect";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("prompt-architect")!;

export const metadata = buildToolMetadata(tool);

export default function PromptArchitectPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="7xl"
      boxed={false}
    >
      <PromptArchitect />
    </ToolLayout>
  );
}
