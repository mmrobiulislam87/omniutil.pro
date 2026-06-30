import ToolLayout from "@/components/ToolLayout";
import { SvgToCode } from "@/components/svg-to-code/SvgToCode";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("svg-to-code")!;

export const metadata = buildToolMetadata(tool);

export default function SvgToCodePage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
    >
      <SvgToCode />
    </ToolLayout>
  );
}
