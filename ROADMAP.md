# OmniUtil.pro — Product Roadmap

> Privacy-first, zero-server-cost utility platform for developers, creators, and professionals.
> All processing happens 100% in the browser — your data never leaves your device.

**Current version:** `v0.2.1`  
**Last updated:** June 29, 2026

---

## Vision

Build the most trusted client-side utility platform on the web — scalable to 100+ tools without codebase chaos, deployable globally with zero backend cost, and loved by developers worldwide for speed, privacy, and polish.

---

## Status Overview

| Phase | Focus | Status |
|-------|--------|--------|
| **MVP** | Core architecture + 3 tools | ✅ Complete |
| **Phase 1** | Polish & Launch | 🚧 In Progress (~90%) |
| **Phase 2** | Growth & new tools | 📋 Planned |
| **Phase 3** | Scale to 100 tools | 📋 Planned |
| **Phase 4** | Ecosystem | 💡 Future |

```
MVP ████████████████████ 100%
P1  ██████████████████░░  90%  ← deploy next
P2  ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## ✅ MVP — v0.1 (Complete)

### Architecture
- [x] Next.js 16 App Router + TypeScript + Tailwind CSS v4
- [x] Dark-centric UI (`#0B0F19` / `#111827`, blue/indigo accents)
- [x] Responsive layout — Sidebar (desktop) + mobile drawer + top bar
- [x] Scalable tool registry (`src/lib/tools.ts`)
- [x] LocalStorage state — favorites, recents
- [x] Hydration-safe `useLocalStorage` hook

### Tools (Live)
- [x] **Media Optimizer** — WASM compression, WebP/JPEG/PNG/AVIF, batch ZIP
- [x] **Prompt Architect** — CO-STAR & RISEN, live preview, draft autosave
- [x] **Data Sanitizer** — PapaParse chunked CSV, dedupe, email/phone validation

### Dashboard
- [x] Hero section + privacy messaging
- [x] Tool card grid with badges, emoji, bookmark (★)
- [x] `Ctrl+K` / `Cmd+K` command palette

---

## 🚧 Phase 1 — Polish & Launch (In Progress)

**Goal:** Production-ready, professional finish, live on `omniutil.pro`  
**Timeline:** 1–2 weeks

### 1.1 UI/UX Unification — ~90%

- [x] Shared `ToolLayout` component
- [x] Blue/dark theme on all tool pages
- [x] `Ctrl+K` / `Cmd+K` command palette
- [x] Remove `ToolPlaceholder`
- [x] Hydration fixes (`useLocalStorage`, Inter font)
- [ ] Consistent loading, empty, and error states across all tools

**Key files:** `ToolLayout.tsx`, `CommandPalette.tsx`, `LayoutShell.tsx`, `FileDropzone.tsx`

### 1.2 Tool Enhancements — ~35%

| Tool | Done | Remaining |
|------|------|-----------|
| **Media Optimizer** | AVIF, batch ZIP (`jszip`) | Before/after slider |
| **Prompt Architect** | CO-STAR, RISEN | RTCE & APE frameworks, template library |
| **Data Sanitizer** | CSV, dedupe, validation | Excel (`.xlsx`), column mapping, anonymize |

### 1.3 SEO & Discoverability — ✅ Complete

- [x] Dynamic `sitemap.ts` — auto-includes all tools from `tools.ts`
- [x] `robots.ts` — crawl rules + sitemap reference
- [x] Global Open Graph + Twitter Card metadata (`layout.tsx`)
- [x] Per-tool metadata via `buildToolMetadata()` (title, description, keywords)
- [x] JSON-LD `WebApplication` schema (`JsonLd.tsx`)
- [x] Web manifest (`manifest.ts`)
- [x] Dynamic OG image (`opengraph-image.tsx`, 1200×630)
- [x] App icons (`icon.tsx`, `apple-icon.tsx`)
- [x] Central config (`src/lib/site.ts`, `.env.example`)

**Live SEO routes (after build):**

| Route | Purpose |
|-------|---------|
| `/sitemap.xml` | Google/Bing index |
| `/robots.txt` | Crawler rules |
| `/manifest.webmanifest` | PWA install |
| `/opengraph-image` | Social share preview |
| `/icon` | Favicon |
| `/apple-icon` | iOS home screen |

**Env var for production:**
```bash
NEXT_PUBLIC_SITE_URL=https://omniutil.pro
```

### 1.4 Deployment — 🔜 Next (only blocker to launch)

- [ ] Vercel production deploy
- [ ] Custom domain: `omniutil.pro`
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel env
- [ ] Production smoke test checklist (see below)
- [ ] Submit sitemap to Google Search Console

**Pre-launch smoke test:**
- [ ] Home, all 3 tool pages load
- [ ] Media Optimizer: compress + download + ZIP
- [ ] Prompt Architect: build + copy prompt
- [ ] Data Sanitizer: upload CSV + clean + export
- [ ] `Ctrl+K` palette works
- [ ] `/sitemap.xml` and `/robots.txt` accessible
- [ ] OG preview valid (share link on Twitter/LinkedIn)

---

## Phase 2 — Growth

**Goal:** Increase traffic, retention, and tool count  
**Timeline:** 2–4 weeks

### 2.1 New Tools (Priority Queue)

| # | Tool | Category | Stack | Status |
|---|------|----------|-------|--------|
| 4 | JSON Formatter & Validator | Dev | Pure JS | 📋 |
| 5 | PDF Merger / Splitter | Document | `pdf-lib` | 📋 |
| 6 | QR Code Generator | Utility | `qrcode` | 📋 |
| 7 | Color Palette Generator | Design | Canvas API | 📋 |
| 8 | Markdown → HTML | Dev | `marked` | 📋 |
| 9 | Password Generator | Security | Web Crypto API | 📋 |
| 10 | Base64 Encode/Decode | Dev | Native APIs | 📋 |

**Adding a new tool:**
1. Add entry to `src/lib/tools.ts` (auto-added to sitemap)
2. Create `src/app/[slug]/page.tsx` with `ToolLayout` + `buildToolMetadata()`
3. Add logic in `src/utils/[tool].ts`
4. Build UI in `src/components/[tool]/`

### 2.2 PWA & Performance
- [x] Web manifest + app icons (Phase 1.3)
- [ ] Service Worker — offline dashboard shell
- [ ] Lighthouse score 95+ (LCP, CLS, INP)
- [ ] Per-tool code splitting / lazy loading
- [ ] Bundle size audit

### 2.3 Privacy-First Analytics
- [ ] Plausible or Umami (no cookies)
- [ ] Page views only — no user data collection

### 2.4 Testing
- [ ] Vitest — unit tests for `src/utils/*`
- [ ] Playwright — E2E: upload → process → download
- [ ] CI: lint + build + test on every PR

---

## Phase 3 — Scale

**Goal:** 100 tools, global audience  
**Timeline:** 1–3 months

### 3.1 Plugin Registry Architecture
- [ ] Extract metadata into `src/tools/registry.ts`
- [ ] Category pages (`/category/dev`, `/category/media`)
- [ ] Tool versioning and changelog per tool

### 3.2 Internationalization (i18n)
- [ ] `next-intl` — English + বাংলা
- [ ] Locale URLs: `omniutil.pro/bn/...`

### 3.3 Content & Community
- [ ] “How it works” SEO section per tool
- [ ] GitHub repository (optional open source)
- [ ] “Request a tool” GitHub Issues template
- [ ] Changelog page (`/changelog`)

### 3.4 Monetization (Optional)

| Tier | Features |
|------|----------|
| **Free** | All tools, unlimited client-side use |
| **Pro** ($5/mo) | Premium templates, early access |
| **Team** | Shared bookmarks, custom branding |

---

## Phase 4 — Ecosystem

- [ ] Browser extension
- [ ] CLI — `npx omniutil compress image.png`
- [ ] Cloudflare Workers API (privacy-preserving)
- [ ] Prompt template marketplace
- [ ] Desktop/mobile wrapper (Tauri / Capacitor)

---

## Release History

### v0.2.1 — SEO & Discoverability (Jun 29, 2026)
- Dynamic sitemap + robots.txt from tool registry
- Open Graph, Twitter Cards, JSON-LD structured data
- Web manifest, dynamic OG image, app icons
- `buildToolMetadata()` for per-tool SEO
- `src/lib/site.ts` central config

### v0.2.0 — Polish & Tools (Jun 2026)
- `ToolLayout`, `CommandPalette` (`Ctrl+K`)
- Media Optimizer: AVIF + batch ZIP
- Blue/dark theme unification
- Hydration fixes

### v0.1.0 — MVP (Jun 2026)
- 3 client-side tools live
- Dashboard, sidebar, favorites/recents
- Zero-server architecture

---

## Priority Matrix

| High impact, low effort | High impact, high effort |
|-------------------------|---------------------------|
| ~~SEO (sitemap, OG)~~ ✅ | Excel support (Data Sanitizer) |
| **Vercel deploy + domain** ← **NOW** | 5–10 new tools |
| Google Search Console submit | i18n (EN + BN) |
| ~~Favicon + manifest~~ ✅ | Before/after image slider |
| ~~AVIF + ZIP~~ ✅ | Plugin registry refactor |

| Low impact, low effort | Low impact, high effort |
|------------------------|-------------------------|
| Analytics (Plausible) | Browser extension |
| Per-tool OG images | CLI tool |
| Changelog page | Native mobile app |
| Unified loading/empty states | |

---

## Recommended Next Steps

1. **Phase 1.4** — Vercel deploy + `omniutil.pro` domain + Search Console
2. **Phase 1.2** — Before/after slider, RTCE/APE, Excel support
3. **Phase 1.1** — Unified loading, empty, and error states
4. **Phase 2.1** — JSON Formatter, PDF Merger, QR Code Generator

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Font | Inter (`next/font`) |
| SEO | `sitemap.ts`, `robots.ts`, `manifest.ts`, `next/og` |
| Image compression | `browser-image-compression` + Canvas (AVIF) |
| CSV parsing | `papaparse` |
| ZIP export | `jszip` |
| Forms | `react-hook-form` |
| Icons | `lucide-react` |
| State | React Context + LocalStorage |
| Hosting (planned) | Vercel (Edge) |

---

## Principles (Non-Negotiable)

1. **Privacy first** — No server uploads for core tool processing
2. **Zero server cost** — Static/edge hosting only
3. **Scalable codebase** — One registry, independent tool modules
4. **Speed** — Sub-second interactions; WASM/workers where needed
5. **Honest UX** — “Processed locally” on every tool
6. **SEO by design** — New tools auto-join sitemap via `tools.ts`

---

## Links

- **Local dev:** `npm run dev` → http://localhost:3000
- **Production:** _Pending deploy — omniutil.pro_
- **Sitemap (post-deploy):** https://omniutil.pro/sitemap.xml
- **Robots (post-deploy):** https://omniutil.pro/robots.txt

---

*This roadmap is a living document. Update checkboxes and phases as work ships.*
