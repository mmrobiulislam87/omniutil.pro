import {
  emptyValuesForFramework,
  getFrameworkById,
  type PromptValues,
} from "@/utils/promptTemplates";

export type PromptTemplateCategory =
  | "writing"
  | "marketing"
  | "development"
  | "business"
  | "research";

export type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  category: PromptTemplateCategory;
  frameworkId: string;
  values: PromptValues;
};

export const PROMPT_TEMPLATE_CATEGORIES: {
  id: PromptTemplateCategory;
  label: string;
  emoji: string;
}[] = [
  { id: "writing", label: "Writing", emoji: "✍️" },
  { id: "marketing", label: "Marketing", emoji: "📣" },
  { id: "development", label: "Development", emoji: "💻" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "research", label: "Research", emoji: "🔬" },
];

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // CO-STAR
  {
    id: "costar-blog-post",
    name: "SEO Blog Post",
    description: "Long-form article with audience-aware tone and structure.",
    category: "writing",
    frameworkId: "costar",
    values: {
      context:
        "I run a privacy-focused SaaS blog targeting developers and founders who care about client-side tooling.",
      objective:
        "Write a 1,200-word blog post explaining why client-side image compression matters for performance and privacy.",
      style: "Educational blog post with H2 sections, short paragraphs, and one code-free analogy.",
      tone: "Confident, practical, and approachable — not salesy.",
      audience: "Mid-level web developers and technical founders.",
      response:
        "Include an intro hook, 4–5 H2 sections, a concise conclusion, and 3 suggested meta descriptions under 155 characters.",
    },
  },
  {
    id: "costar-landing-page",
    name: "Landing Page Copy",
    description: "Conversion-focused hero, benefits, and CTA blocks.",
    category: "marketing",
    frameworkId: "costar",
    values: {
      context:
        "Product: OmniUtil.pro — free browser-based utilities. No uploads, 100% client-side processing.",
      objective:
        "Write above-the-fold landing page copy that drives sign-ups and first tool usage.",
      style: "SaaS landing page — headline, subhead, 3 benefit bullets, social proof placeholder, CTA.",
      tone: "Premium, trustworthy, and energetic.",
      audience: "Creators, developers, and ops professionals who handle files and data daily.",
      response:
        "Max 220 words total. Provide 2 headline options and one primary CTA button label.",
    },
  },
  {
    id: "costar-api-docs",
    name: "API Documentation",
    description: "Clear endpoint docs for internal or public developers.",
    category: "development",
    frameworkId: "costar",
    values: {
      context:
        "REST API for user preferences sync. Auth via bearer token. Rate limit 100 req/min.",
      objective:
        "Document the GET /v1/preferences and PATCH /v1/preferences endpoints.",
      style: "Technical reference with request/response examples in JSON.",
      tone: "Precise and neutral.",
      audience: "Backend and frontend engineers integrating the API.",
      response:
        "Include parameters table, example curl commands, error codes, and a short 'when to use' note per endpoint.",
    },
  },
  // RISEN
  {
    id: "risen-code-review",
    name: "Code Review Agent",
    description: "Structured PR review with security and readability checks.",
    category: "development",
    frameworkId: "risen",
    values: {
      role: "You are a staff software engineer specializing in TypeScript, React, and secure client-side apps.",
      instructions:
        "Review the pull request diff for bugs, regressions, accessibility issues, and unnecessary complexity.",
      steps:
        "1. Summarize the change intent\n2. List blocking issues\n3. List non-blocking suggestions\n4. Flag security/privacy risks\n5. Give a merge recommendation",
      endGoal:
        "A actionable review the author can apply in under 30 minutes.",
      narrowing:
        "Focus only on changed files. Do not nitpick formatting. No generic advice without file references.",
    },
  },
  {
    id: "risen-onboarding",
    name: "Employee Onboarding Plan",
    description: "30-day ramp plan for a new team member.",
    category: "business",
    frameworkId: "risen",
    values: {
      role: "You are an engineering manager at a 15-person product startup.",
      instructions:
        "Create a 30-day onboarding plan for a new full-stack engineer joining next Monday.",
      steps:
        "Week 1: Environment, codebase tour, shadowing\nWeek 2: First small PRs\nWeek 3: Own a feature slice\nWeek 4: On-call shadow + retrospective",
      endGoal:
        "The hire ships a small production feature by day 30 and feels connected to the team.",
      narrowing:
        "Remote-first team, UTC+6 primary timezone. Stack: Next.js, TypeScript, Vercel. No HR policy details.",
    },
  },
  {
    id: "risen-content-repurpose",
    name: "Content Repurposing",
    description: "Turn one asset into multi-channel posts.",
    category: "marketing",
    frameworkId: "risen",
    values: {
      role: "You are a B2B content strategist for developer tools.",
      instructions:
        "Repurpose a long-form blog post into LinkedIn, X thread, and newsletter snippets.",
      steps:
        "1. Extract 3 core insights\n2. Draft LinkedIn post (130 words)\n3. Draft X thread (5 tweets)\n4. Draft newsletter blurb (80 words)",
      endGoal: "Ready-to-publish social copy that preserves the original thesis.",
      narrowing:
        "No hashtag spam. Avoid buzzwords. Keep technical accuracy. I will paste the blog post below.",
    },
  },
  // RTCE
  {
    id: "rtce-ux-research",
    name: "UX Research Brief",
    description: "Plan interviews or usability tests with clear scope.",
    category: "research",
    frameworkId: "rtce",
    values: {
      role: "You are a senior UX researcher at a B2C fintech company.",
      task: "Draft a moderated usability test plan for a redesigned mobile checkout flow.",
      context:
        "Goal: reduce drop-off at payment step. Participants: existing customers aged 25–45. Test length: 45 minutes remote.",
      examples:
        "Good task prompt: 'Buy a $29 subscription using a saved card.'\nGood success metric: completes payment in under 3 minutes without assistance.",
    },
  },
  {
    id: "rtce-competitive-analysis",
    name: "Competitive Analysis",
    description: "Compare features and positioning vs rivals.",
    category: "business",
    frameworkId: "rtce",
    values: {
      role: "You are a product strategist analyzing the online utilities market.",
      task: "Compare OmniUtil.pro against two client-side utility competitors on privacy, speed, and tool breadth.",
      context:
        "We win on zero-upload privacy and WASM image tools. We lack PDF tools today. Audience: global English-speaking pros.",
      examples:
        "Output table columns: Feature | Us | Competitor A | Competitor B | Notes\nInclude a 3-sentence positioning recommendation.",
    },
  },
  {
    id: "rtce-tutorial",
    name: "Tutorial Outline",
    description: "Step-by-step guide structure with examples.",
    category: "writing",
    frameworkId: "rtce",
    values: {
      role: "You are a technical educator who writes for beginner developers.",
      task: "Outline a tutorial: 'Build your first client-side CSV cleaner with PapaParse.'",
      context:
        "Readers know basic JavaScript but not file APIs. Tutorial should run entirely in the browser. Target length: 1,500 words.",
      examples:
        "Section pattern:\n- What you'll build (screenshot placeholder)\n- Step N with code snippet\n- Common mistake callout",
    },
  },
  // APE
  {
    id: "ape-meeting-summary",
    name: "Meeting Summary",
    description: "Fast recap of decisions and action items.",
    category: "business",
    frameworkId: "ape",
    values: {
      action: "Summarize the meeting transcript I will paste below.",
      purpose:
        "I need a shareable recap for teammates who missed the call.",
      expectation:
        "5 bullet points max: decisions, owners, deadlines. Under 20 words per bullet. No filler.",
    },
  },
  {
    id: "ape-support-reply",
    name: "Support Email Reply",
    description: "Empathetic customer response with clear next steps.",
    category: "business",
    frameworkId: "ape",
    values: {
      action:
        "Draft a reply to a customer who cannot export cleaned data from our CSV tool.",
      purpose:
        "Retain trust and unblock them before they churn.",
      expectation:
        "Under 120 words. Acknowledge once, give 3 numbered troubleshooting steps, offer escalation path. Professional but warm.",
    },
  },
  {
    id: "ape-social-hook",
    name: "Social Post Hook",
    description: "Attention-grabbing opener for LinkedIn or X.",
    category: "marketing",
    frameworkId: "ape",
    values: {
      action:
        "Write 5 opening hooks for a post about building privacy-first web tools without a backend.",
      purpose:
        "Stop the scroll and drive clicks to our launch thread.",
      expectation:
        "Each hook under 18 words. Mix curiosity, contrarian, and proof-led angles. No emojis.",
    },
  },
];

export function getTemplatesForFramework(frameworkId: string): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter((t) => t.frameworkId === frameworkId);
}

export function getTemplatesByCategory(
  category: PromptTemplateCategory | "all",
): PromptTemplate[] {
  if (category === "all") return PROMPT_TEMPLATES;
  return PROMPT_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((t) => t.id === id);
}

export function resolveTemplateValues(template: PromptTemplate): PromptValues {
  const framework = getFrameworkById(template.frameworkId);
  if (!framework) return { ...template.values };

  return {
    ...emptyValuesForFramework(framework),
    ...template.values,
  };
}
