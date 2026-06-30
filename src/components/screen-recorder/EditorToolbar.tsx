"use client";

import type { ReactNode } from "react";
import {
  Merge,
  Redo2,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type EditorToolbarProps = {
  disabled?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSplit: boolean;
  canDelete: boolean;
  canMerge: boolean;
  zoom: number;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onMerge: () => void;
  onSkip: (delta: number) => void;
  onZoomChange: (zoom: number) => void;
};

function ToolBtn({
  label,
  shortcut,
  disabled,
  onClick,
  children,
  variant = "ghost",
  className,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition",
        variant === "secondary"
          ? "border-gray-700 bg-gray-800/80 text-gray-200 hover:border-gray-600"
          : "border-transparent text-gray-400 hover:border-gray-700 hover:bg-gray-800/60 hover:text-gray-200",
        disabled && "pointer-events-none opacity-35",
        className,
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
      {shortcut && (
        <kbd className="ml-0.5 hidden rounded border border-gray-700 bg-gray-900 px-1 font-mono text-[9px] text-gray-500 lg:inline">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function EditorToolbar({
  disabled,
  canUndo,
  canRedo,
  canSplit,
  canDelete,
  canMerge,
  zoom,
  onUndo,
  onRedo,
  onSplit,
  onDelete,
  onMerge,
  onSkip,
  onZoomChange,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-800/60 bg-[#080c14] px-3 py-2">
      <div className="flex items-center gap-0.5 border-r border-gray-800/80 pr-2">
        <ToolBtn
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={disabled || !canUndo}
          onClick={onUndo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Redo"
          shortcut="Ctrl+Y"
          disabled={disabled || !canRedo}
          onClick={onRedo}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      <div className="flex items-center gap-0.5 border-r border-gray-800/80 px-2">
        <ToolBtn
          label="Split"
          shortcut="S"
          disabled={disabled || !canSplit}
          onClick={onSplit}
          variant="secondary"
        >
          <Scissors className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Delete"
          shortcut="Del"
          disabled={disabled || !canDelete}
          onClick={onDelete}
          className="hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Merge"
          shortcut="M"
          disabled={disabled || !canMerge}
          onClick={onMerge}
        >
          <Merge className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      <div className="flex items-center gap-0.5 border-r border-gray-800/80 px-2">
        <ToolBtn
          label="-1s"
          shortcut="←"
          disabled={disabled}
          onClick={() => onSkip(-1)}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="+1s"
          shortcut="→"
          disabled={disabled}
          onClick={() => onSkip(1)}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Start"
          disabled={disabled}
          onClick={() => onSkip(-Infinity)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      <div className="flex items-center gap-1.5 pl-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || zoom <= 1}
          className="h-8 w-8 p-0"
          onClick={() => onZoomChange(Math.max(1, zoom - 1))}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-8 text-center font-mono text-[10px] text-gray-500">
          {zoom}×
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || zoom >= 6}
          className="h-8 w-8 p-0"
          onClick={() => onZoomChange(Math.min(6, zoom + 1))}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
