"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { filterTools, getToolById } from "@/lib/tools";
import { cn } from "@/lib/cn";

type PaletteItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  emoji?: string;
  group: string;
};

export default function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, favorites, recents } =
    useApp();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const list: PaletteItem[] = [];
    const normalized = query.trim().toLowerCase();
    const matchesDashboard =
      !normalized ||
      "dashboard".includes(normalized) ||
      "home".includes(normalized);

    if (matchesDashboard) {
      list.push({
        id: "dashboard",
        label: "Dashboard",
        description: "Back to all tools",
        href: "/",
        emoji: "🏠",
        group: "Navigation",
      });
    }

    const addToolGroup = (ids: string[], group: string) => {
      ids.forEach((id) => {
        const tool = getToolById(id);
        if (!tool) return;
        const filtered = filterTools(query);
        if (!filtered.some((t) => t.id === id) && query.trim()) return;
        if (list.some((i) => i.id === tool.id)) return;
        list.push({
          id: tool.id,
          label: tool.dashboardTitle,
          description: tool.description,
          href: tool.href,
          emoji: tool.emoji,
          group,
        });
      });
    };

    if (!query.trim()) {
      addToolGroup(favorites, "Favorites");
      addToolGroup(recents, "Recent");
    }

    filterTools(query).forEach((tool) => {
      if (list.some((i) => i.id === tool.id)) return;
      list.push({
        id: tool.id,
        label: tool.dashboardTitle,
        description: tool.description,
        href: tool.href,
        emoji: tool.emoji,
        group: "Tools",
      });
    });

    return list;
  }, [query, favorites, recents]);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, [setCommandPaletteOpen]);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1),
        );
      }

      if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        navigate(items[selectedIndex].href);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, items, selectedIndex, close, navigate]);

  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  const grouped = items.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-label="Close command palette"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-gray-700 bg-[#111827] shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-3 border-b border-gray-800 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search tools or type a command…"
            className="flex-1 bg-transparent py-4 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
          />
          <kbd className="hidden rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group}
                </p>
                {groupItems.map((item) => {
                  const index = flatIndex++;
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-selected={selected}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "bg-blue-500/15 text-blue-400"
                          : "text-gray-300 hover:bg-gray-800",
                      )}
                    >
                      <span className="text-lg leading-none">
                        {item.emoji ?? (
                          <Home className="h-4 w-4 text-gray-500" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.label}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-800 px-4 py-2 text-[10px] text-gray-600">
          <span>
            <kbd className="rounded border border-gray-700 px-1">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-700 px-1">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded border border-gray-700 px-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
