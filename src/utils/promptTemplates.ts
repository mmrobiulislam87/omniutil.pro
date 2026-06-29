export type PromptField = {
  key: string;
  label: string;
  placeholder: string;
  description: string;
};

export type PromptFramework = {
  id: string;
  name: string;
  description: string;
  fields: PromptField[];
};

export const COSTAR_FRAMEWORK: PromptFramework = {
  id: "costar",
  name: "CO-STAR",
  description:
    "Context, Objective, Style, Tone, Audience, Response — a proven framework for precise AI prompts.",
  fields: [
    {
      key: "context",
      label: "Context",
      placeholder: "Background information the AI needs…",
      description: "Relevant facts, situation, or constraints.",
    },
    {
      key: "objective",
      label: "Objective",
      placeholder: "What you want the AI to accomplish…",
      description: "The specific task or goal.",
    },
    {
      key: "style",
      label: "Style",
      placeholder: "e.g. Technical report, blog post, bullet points…",
      description: "Format and writing style.",
    },
    {
      key: "tone",
      label: "Tone",
      placeholder: "e.g. Professional, friendly, authoritative…",
      description: "Emotional quality of the response.",
    },
    {
      key: "audience",
      label: "Audience",
      placeholder: "e.g. Senior engineers, marketing team…",
      description: "Who will read or use the output.",
    },
    {
      key: "response",
      label: "Response",
      placeholder: "e.g. Max 500 words, include code examples…",
      description: "Output format and length constraints.",
    },
  ],
};

export type PromptValues = Record<string, string>;

export type PromptFormat = "structured" | "plain";

export function buildPromptFromFramework(
  framework: PromptFramework,
  values: PromptValues,
  format: PromptFormat = "structured",
): string {
  const filled = framework.fields.filter((field) => values[field.key]?.trim());

  if (filled.length === 0) return "";

  if (format === "plain") {
    return filled
      .map((field) => `${field.label}:\n${values[field.key].trim()}`)
      .join("\n\n");
  }

  return filled
    .map((field) => `**${field.label}:**\n${values[field.key].trim()}`)
    .join("\n\n");
}

export const RISEN_FRAMEWORK: PromptFramework = {
  id: "risen",
  name: "RISEN",
  description:
    "Role, Instructions, Steps, End goal, Narrowing — ideal for task-oriented agent prompts.",
  fields: [
    {
      key: "role",
      label: "Role",
      placeholder: "e.g. You are a senior data analyst…",
      description: "The persona the AI should adopt.",
    },
    {
      key: "instructions",
      label: "Instructions",
      placeholder: "High-level directives for the task…",
      description: "What the AI must do.",
    },
    {
      key: "steps",
      label: "Steps",
      placeholder: "1. Analyze the data\n2. Identify trends…",
      description: "Sequential actions to follow.",
    },
    {
      key: "endGoal",
      label: "End Goal",
      placeholder: "The desired outcome or deliverable…",
      description: "What success looks like.",
    },
    {
      key: "narrowing",
      label: "Narrowing",
      placeholder: "Constraints, scope limits, exclusions…",
      description: "Boundaries to keep the output focused.",
    },
  ],
};

export const RTCE_FRAMEWORK: PromptFramework = {
  id: "rtce",
  name: "RTCE",
  description:
    "Role, Task, Context, Examples — ground the model with persona, clear action, background, and reference outputs.",
  fields: [
    {
      key: "role",
      label: "Role",
      placeholder: "e.g. You are a senior UX researcher…",
      description: "Expertise or perspective the AI should adopt.",
    },
    {
      key: "task",
      label: "Task",
      placeholder: "e.g. Draft a usability test plan for a mobile checkout flow…",
      description: "The specific action or deliverable you need.",
    },
    {
      key: "context",
      label: "Context",
      placeholder: "Audience, constraints, purpose, or background facts…",
      description: "Situation details that shape a relevant response.",
    },
    {
      key: "examples",
      label: "Examples",
      placeholder: "Sample inputs, ideal outputs, or patterns to follow…",
      description: "Reference material that demonstrates what good looks like.",
    },
  ],
};

export const APE_FRAMEWORK: PromptFramework = {
  id: "ape",
  name: "APE",
  description:
    "Action, Purpose, Expectation — a minimal three-field framework for fast, high-impact everyday prompts.",
  fields: [
    {
      key: "action",
      label: "Action",
      placeholder: "e.g. Summarize this meeting transcript into key decisions…",
      description: "What you want the AI to do — the core verb of the request.",
    },
    {
      key: "purpose",
      label: "Purpose",
      placeholder: "e.g. I need a quick reference before tomorrow's standup…",
      description: "Why you need the output and how you will use it.",
    },
    {
      key: "expectation",
      label: "Expectation",
      placeholder: "e.g. 5 bullet points, under 20 words each, decisions only…",
      description: "Format, length, tone, or quality bar for the response.",
    },
  ],
};

export const PROMPT_FRAMEWORKS = [
  COSTAR_FRAMEWORK,
  RISEN_FRAMEWORK,
  RTCE_FRAMEWORK,
  APE_FRAMEWORK,
];

export function getFrameworkById(id: string): PromptFramework | undefined {
  return PROMPT_FRAMEWORKS.find((f) => f.id === id);
}

export function emptyValuesForFramework(framework: PromptFramework): PromptValues {
  return Object.fromEntries(framework.fields.map((field) => [field.key, ""]));
}
