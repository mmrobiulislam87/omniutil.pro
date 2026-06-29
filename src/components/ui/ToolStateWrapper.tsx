import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToolStateWrapperProps = {
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  children?: ReactNode;
  className?: string;
};

export function ToolStateWrapper({
  isLoading,
  loadingMessage = "Processing data locally…",
  error,
  isEmpty,
  emptyMessage = "No data available to display.",
  emptyIcon = "📂",
  children,
  className,
}: ToolStateWrapperProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center space-y-4 py-16",
          className,
        )}
      >
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <p className="animate-pulse text-sm font-medium text-gray-400">
          {loadingMessage}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ToolErrorBanner message={error} className={className} />
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 border-dashed border-gray-800 p-6 py-12 text-center",
          className,
        )}
      >
        <span className="mb-3 block text-3xl">{emptyIcon}</span>
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function ToolErrorBanner({
  message,
  title = "Processing Error",
  variant = "banner",
  className,
}: {
  message: string;
  title?: string;
  variant?: "banner" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <p className={cn("text-sm text-red-400", className)} role="alert">
        {message}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4",
        className,
      )}
      role="alert"
    >
      <span className="text-xl" aria-hidden>
        ⚠️
      </span>
      <div>
        <h4 className="text-sm font-bold text-red-400">{title}</h4>
        <p className="mt-1 text-xs text-gray-400">{message}</p>
      </div>
    </div>
  );
}
