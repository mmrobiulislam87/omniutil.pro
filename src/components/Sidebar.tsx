"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Star, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getToolById, TOOLS } from "@/lib/tools";
import { cn } from "@/lib/cn";

function ToolLink({
  href,
  label,
  emoji,
  active,
  onClick,
}: {
  href: string;
  label: string;
  emoji?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
        active
          ? "bg-blue-500/10 text-blue-400"
          : "text-gray-400 hover:text-blue-400",
      )}
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { favorites, recents, sidebarOpen, setSidebarOpen } = useApp();

  const closeSidebar = () => setSidebarOpen(false);

  const content = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2"
            onClick={closeSidebar}
          >
            <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-xl font-bold text-transparent">
              OmniUtil
              <span className="text-sm font-medium text-gray-400">.pro</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Core Tools
            </h3>
            <ul className="space-y-1">
              {TOOLS.map((tool) => (
                <li key={tool.id}>
                  <ToolLink
                    href={tool.href}
                    label={tool.name}
                    emoji={tool.emoji}
                    active={pathname === tool.href}
                    onClick={closeSidebar}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Star className="h-3 w-3" />
              Favorites
            </h3>
            {favorites.length > 0 ? (
              <ul className="space-y-1">
                {favorites.map((id) => {
                  const tool = getToolById(id);
                  if (!tool) return null;
                  return (
                    <li key={id}>
                      <ToolLink
                        href={tool.href}
                        label={tool.name}
                        emoji={tool.emoji}
                        active={pathname === tool.href}
                        onClick={closeSidebar}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs italic text-gray-600">No bookmarks yet</p>
            )}
          </div>

          {recents.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Clock className="h-3 w-3" />
                Recent
              </h3>
              <ul className="space-y-1">
                {recents.map((id) => {
                  const tool = getToolById(id);
                  if (!tool) return null;
                  return (
                    <li key={id}>
                      <ToolLink
                        href={tool.href}
                        label={tool.name}
                        active={pathname === tool.href}
                        onClick={closeSidebar}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-800 pt-4 text-xs text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <span className="flex-1">100% Serverless &amp; Secure</span>
        <kbd className="rounded border border-gray-700 px-1 py-0.5 text-[10px] text-gray-600">
          ⌘K
        </kbd>
      </div>
    </div>
  );

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-gray-800 bg-[#111827] p-6 transition-transform duration-200 md:sticky md:top-0 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {content}
      </aside>
    </>
  );
}
