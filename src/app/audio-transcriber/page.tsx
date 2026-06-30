import ToolLayout from "@/components/ToolLayout";
import { AudioTranscriber } from "@/components/audio-transcriber/AudioTranscriber";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("audio-transcriber")!;

export const metadata = buildToolMetadata(tool);

export default function AudioTranscriberPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <AudioTranscriber />
    </ToolLayout>
  );
}
