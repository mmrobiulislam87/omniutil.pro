"use client";

import { Menu, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function MobileTopBar() {
  const { setSidebarOpen, setCommandPaletteOpen } = useApp();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-[#0B0F19]/90 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-blue-400"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="relative flex flex-1 items-center rounded-lg border border-gray-800 bg-[#111827] py-2.5 pl-9 pr-3 text-left text-sm text-gray-500"
        >
          <Search className="pointer-events-none absolute left-3 h-4 w-4" />
          Search tools…
        </button>
      </div>
    </header>
  );
}
