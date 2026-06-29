import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type MaxWidth = "4xl" | "5xl" | "6xl" | "7xl";

const maxWidthClasses: Record<MaxWidth, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export type ToolLayoutProps = {
  title: string;
  description: string;
  icon: string;
  badge?: string;
  maxWidth?: MaxWidth;
  /** Wrap children in the standard tool card. Disable for multi-panel layouts. */
  boxed?: boolean;
  children: ReactNode;
};

export default function ToolLayout({
  title,
  description,
  icon,
  badge,
  maxWidth = "5xl",
  boxed = true,
  children,
}: ToolLayoutProps) {
  return (
    <div className={cn("mx-auto space-y-6", maxWidthClasses[maxWidth])}>
      <div className="flex flex-col gap-3 border-b border-gray-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="group flex items-center gap-1 text-sm text-gray-400 transition hover:text-blue-400"
        >
          <span className="transform transition duration-200 group-hover:-translate-x-1">
            ←
          </span>
          Back to Dashboard
        </Link>

        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          100% Client-Side Processing
        </div>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl md:text-4xl">{icon}</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          {badge && (
            <span className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {badge}
            </span>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
          {description}
        </p>
      </header>

      {boxed ? (
        <section className="rounded-2xl border border-gray-800 bg-[#111827] p-6 shadow-xl md:p-8">
          {children}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
