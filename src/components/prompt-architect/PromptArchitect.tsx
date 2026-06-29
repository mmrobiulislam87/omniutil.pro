"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToolStateWrapper } from "@/components/ui/ToolStateWrapper";
import { TemplateLibrary } from "@/components/prompt-architect/TemplateLibrary";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/cn";
import {
  PROMPT_FRAMEWORKS,
  buildPromptFromFramework,
  emptyValuesForFramework,
  type PromptFormat,
  type PromptFramework,
  type PromptValues,
} from "@/utils/promptTemplates";
import {
  resolveTemplateValues,
  type PromptTemplate,
} from "@/utils/promptTemplateLibrary";

const STORAGE_KEY = "omniutil-prompt-architect";

type SavedDraft = {
  frameworkId: string;
  values: PromptValues;
  format: PromptFormat;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function PromptArchitect() {
  const [savedDraft, setSavedDraft, storageReady] = useLocalStorage<SavedDraft | null>(
    STORAGE_KEY,
    null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [frameworkId, setFrameworkId] = useState(PROMPT_FRAMEWORKS[0].id);
  const [format, setFormat] = useState<PromptFormat>("structured");
  const [copied, setCopied] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const framework = useMemo(
    () =>
      PROMPT_FRAMEWORKS.find((f) => f.id === frameworkId) ??
      PROMPT_FRAMEWORKS[0],
    [frameworkId],
  );

  const { register, watch, reset, formState } = useForm<PromptValues>({
    defaultValues: emptyValuesForFramework(framework),
  });

  const values = watch();

  useEffect(() => {
    if (!storageReady) return;
    if (savedDraft) {
      const draftFramework =
        PROMPT_FRAMEWORKS.find((f) => f.id === savedDraft.frameworkId) ??
        PROMPT_FRAMEWORKS[0];
      setFrameworkId(draftFramework.id);
      setFormat(savedDraft.format);
      reset(savedDraft.values);
    }
    setHydrated(true);
  }, [storageReady, savedDraft, reset]);

  const masterPrompt = buildPromptFromFramework(framework, values, format);
  const filledCount = framework.fields.filter((f) =>
    values[f.key]?.trim(),
  ).length;

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      setSavedDraft({ frameworkId, values, format });
    }, 400);
    return () => clearTimeout(timeout);
  }, [frameworkId, values, format, setSavedDraft, hydrated]);

  const handleFrameworkChange = useCallback(
    (nextId: string) => {
      const nextFramework =
        PROMPT_FRAMEWORKS.find((f) => f.id === nextId) ?? PROMPT_FRAMEWORKS[0];
      setFrameworkId(nextId);
      setActiveTemplateId(null);
      reset(emptyValuesForFramework(nextFramework));
    },
    [reset],
  );

  const handleTemplateSelect = useCallback(
    (template: PromptTemplate) => {
      setFrameworkId(template.frameworkId);
      setActiveTemplateId(template.id);
      reset(resolveTemplateValues(template));
    },
    [reset],
  );

  const handleCopy = useCallback(async () => {
    if (!masterPrompt) return;
    try {
      await navigator.clipboard.writeText(masterPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = masterPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [masterPrompt]);

  const handleClear = useCallback(() => {
    setActiveTemplateId(null);
    reset(emptyValuesForFramework(framework));
  }, [framework, reset]);

  if (!hydrated) {
    return (
      <ToolStateWrapper
        isLoading
        loadingMessage="Restoring your draft locally…"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {PROMPT_FRAMEWORKS.map((fw: PromptFramework) => (
            <button
              key={fw.id}
              type="button"
              onClick={() => handleFrameworkChange(fw.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                frameworkId === fw.id
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300",
              )}
            >
              {fw.name}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-700 p-0.5">
          {(["structured", "plain"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                format === f
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-300",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">{framework.description}</p>

      <TemplateLibrary
        frameworkId={frameworkId}
        activeTemplateId={activeTemplateId}
        onSelect={handleTemplateSelect}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section className="space-y-5 rounded-2xl border border-gray-800 bg-[#111827] p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Framework fields
            </h2>
            <span className="text-xs text-gray-500">
              {filledCount}/{framework.fields.length} filled
            </span>
          </div>

          {framework.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div>
                <Label htmlFor={field.key}>{field.label}</Label>
                <p className="mt-0.5 text-xs text-gray-500">{field.description}</p>
              </div>
              <Textarea
                id={field.key}
                placeholder={field.placeholder}
                rows={3}
                {...register(field.key)}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={!formState.isDirty && filledCount === 0}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Clear all fields
          </Button>
        </section>

        <section className="lg:sticky lg:top-8 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#111827] shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">Master Prompt</h2>
                <p className="text-xs text-gray-500">
                  {masterPrompt.length} chars · {countWords(masterPrompt)} words
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                disabled={!masterPrompt}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="max-h-[60vh] min-h-[320px] overflow-y-auto p-5">
              {masterPrompt ? (
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-200">
                  {masterPrompt}
                </pre>
              ) : (
                <ToolStateWrapper
                  isEmpty
                  emptyIcon="✨"
                  emptyMessage="Your prompt will appear here. Start filling in the fields on the left."
                  className="min-h-[280px] border-0"
                />
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-gray-600">
            Draft auto-saved locally in your browser
          </p>
        </section>
      </div>
    </div>
  );
}
