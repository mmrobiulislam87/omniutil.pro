"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getToolById } from "@/lib/tools";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppContextValue = {
  favorites: string[];
  toggleFavorite: (toolId: string) => void;
  isFavorite: (toolId: string) => boolean;
  recents: string[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const MAX_RECENTS = 8;

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    "omniutil-favorites",
    [],
  );
  const [recents, setRecents] = useLocalStorage<string[]>(
    "omniutil-recents",
    [],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((open) => !open);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCommandPalette]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return;

    const tool = getToolById(segments[0]);
    if (!tool) return;

    setRecents((prev) => {
      const next = [tool.id, ...prev.filter((id) => id !== tool.id)];
      return next.slice(0, MAX_RECENTS);
    });
  }, [pathname, setRecents]);

  const toggleFavorite = useCallback(
    (toolId: string) => {
      setFavorites((prev) =>
        prev.includes(toolId)
          ? prev.filter((id) => id !== toolId)
          : [...prev, toolId],
      );
    },
    [setFavorites],
  );

  const isFavorite = useCallback(
    (toolId: string) => favorites.includes(toolId),
    [favorites],
  );

  const value = useMemo(
    () => ({
      favorites,
      toggleFavorite,
      isFavorite,
      recents,
      sidebarOpen,
      setSidebarOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      toggleCommandPalette,
    }),
    [
      favorites,
      toggleFavorite,
      isFavorite,
      recents,
      sidebarOpen,
      commandPaletteOpen,
      toggleCommandPalette,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
