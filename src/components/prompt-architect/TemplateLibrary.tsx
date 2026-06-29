"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PROMPT_TEMPLATE_CATEGORIES,
  PROMPT_TEMPLATES,
  type PromptTemplate,
  type PromptTemplateCategory,
} from "@/utils/promptTemplateLibrary";

type TemplateLibraryProps = {
  frameworkId: string;
  activeTemplateId?: string | null;
  onSelect: (template: PromptTemplate) => void;
};

export function TemplateLibrary({
  frameworkId,
  activeTemplateId,
  onSelect,
}: TemplateLibraryProps) {
  const [category, setCategory] = useState<PromptTemplateCategory | "all">(
    "all",
  );
  const [showAllFrameworks, setShowAllFrameworks] = useState(false);

  const templates = useMemo(() => {
    const byCategory =
      category === "all"
        ? PROMPT_TEMPLATES
        : PROMPT_TEMPLATES.filter((t) => t.category === category);

    if (showAllFrameworks) return byCategory;
    return byCategory.filter((t) => t.frameworkId === frameworkId);
  }, [category, frameworkId, showAllFrameworks]);

  return (
    <section className="rounded-2xl border border-gray-800 bg-[#111827] p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <BookOpen className="h-4 w-4" />
            Template library
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Curated starter prompts — click to load into the editor.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={showAllFrameworks}
            onChange={(e) => setShowAllFrameworks(e.target.checked)}
            className="accent-blue-500"
          />
          Show all frameworks
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CategoryChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          label="All"
        />
        {PROMPT_TEMPLATE_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.id}
            active={category === cat.id}
            onClick={() => setCategory(cat.id)}
            label={`${cat.emoji} ${cat.label}`}
          />
        ))}
      </div>

      {templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-800 py-8 text-center text-sm text-gray-500">
          No templates for this filter. Try &ldquo;Show all frameworks&rdquo;.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                activeTemplateId === template.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-800 bg-[#0B0F19]/50 hover:border-gray-700 hover:bg-[#0B0F19]",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-100">
                  {template.name}
                </span>
                <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {template.frameworkId}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-blue-500 bg-blue-500/10 text-blue-400"
          : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300",
      )}
    >
      {label}
    </button>
  );
}
