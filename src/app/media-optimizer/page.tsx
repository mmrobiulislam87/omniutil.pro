import ToolLayout from "@/components/ToolLayout";
import { MediaOptimizer } from "@/components/media-optimizer/MediaOptimizer";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("media-optimizer")!;

export const metadata = buildToolMetadata(tool);

export default function MediaOptimizerPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <MediaOptimizer />
    </ToolLayout>
  );
}
