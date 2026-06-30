import ToolLayout from "@/components/ToolLayout";
import { JwtDebugger } from "@/components/jwt-debugger/JwtDebugger";
import { buildToolMetadata, getToolById } from "@/lib/tools";

const tool = getToolById("jwt-debugger")!;

export const metadata = buildToolMetadata(tool);

export default function JwtDebuggerPage() {
  return (
    <ToolLayout
      title={tool.dashboardTitle}
      description={tool.description}
      icon={tool.emoji}
      badge={tool.badge}
      maxWidth="5xl"
    >
      <JwtDebugger />
    </ToolLayout>
  );
}
