import ToolLayout from "@/components/ToolLayout";
import { ScreenRecorder } from "@/components/screen-recorder/ScreenRecorder";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("screen-recorder")!;

export const metadata = buildToolMetadata(tool);

export default function ScreenRecorderPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="6xl"
      boxed={false}
    >
      <ScreenRecorder />
    </ToolLayout>
  );
}
