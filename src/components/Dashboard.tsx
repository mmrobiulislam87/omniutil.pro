"use client";

import Link from "next/link";
import { Search, Star } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { TOOLS } from "@/lib/tools";
import { cn } from "@/lib/cn";

export function Dashboard() {
  const { isFavorite, toggleFavorite, setCommandPaletteOpen } = useApp();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 text-center md:mb-12 md:text-left">
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          Smart Utilities.{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Zero Server Costs.
          </span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-gray-400">
          Your files and data never leave your device. Process everything
          securely at lightning speed with next-generation client-side
          architecture.
        </p>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="relative mx-auto mt-6 hidden w-full max-w-lg rounded-lg border border-gray-800 bg-[#111827] py-2.5 pl-9 pr-20 text-left text-sm text-gray-500 transition hover:border-gray-700 hover:text-gray-400 md:mx-0 md:flex"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          Search tools…
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
            Ctrl+K
          </kbd>
        </button>
      </header>

      <section>
        <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-300">
          <span>🎯</span> Featured Productivity Hub
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
              const favorited = isFavorite(tool.id);
              return (
                <div
                  key={tool.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-800 bg-[#111827] p-6 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <button
                    type="button"
                    onClick={() => toggleFavorite(tool.id)}
                    className={cn(
                      "absolute right-4 top-4 rounded-lg p-1.5 transition",
                      favorited
                        ? "text-amber-400"
                        : "text-gray-600 hover:text-amber-400",
                    )}
                    aria-label={
                      favorited ? "Remove from favorites" : "Add to favorites"
                    }
                  >
                    <Star
                      className={cn("h-4 w-4", favorited && "fill-current")}
                    />
                  </button>

                  <Link href={tool.href} className="flex flex-1 flex-col">
                    <div>
                      <div className="mb-4 flex items-start justify-between pr-8">
                        <span className="text-3xl">{tool.emoji}</span>
                        <span className="rounded border border-gray-700 bg-gray-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition group-hover:border-blue-500/30">
                          {tool.badge}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-white transition group-hover:text-blue-400">
                        {tool.dashboardTitle}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-400">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-blue-400 transition group-hover:text-blue-300">
                      Launch Tool <span>→</span>
                    </div>
                  </Link>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
