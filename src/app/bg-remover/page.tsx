import ToolLayout from "@/components/ToolLayout";
import { BgRemover } from "@/components/bg-remover/BgRemover";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("bg-remover")!;

export const metadata = buildToolMetadata(tool);

export default function BgRemoverPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <BgRemover />
    </ToolLayout>
  );
}
