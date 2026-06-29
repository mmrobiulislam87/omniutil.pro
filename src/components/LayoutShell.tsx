"use client";

import CommandPalette from "@/components/CommandPalette";
import MobileTopBar from "@/components/MobileTopBar";
import Sidebar from "@/components/Sidebar";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-12">{children}</main>
      </div>
      <CommandPalette />
    </>
  );
}
