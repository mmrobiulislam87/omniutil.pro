# OmniUtil.pro — Product Roadmap

> Privacy-first, zero-server-cost utility platform for developers, creators, and professionals.
> All processing happens 100% in the browser — your data never leaves your device.

**Current version:** `v0.8.0`  
**Last updated:** June 29, 2026

---

## Vision

Build the most trusted client-side utility platform on the web — scalable to 100+ tools without codebase chaos, deployable globally with zero backend cost, and loved by developers worldwide for speed, privacy, and polish.

---

## Status Overview

| Phase | Focus | Status |
|-------|--------|--------|
| **MVP** | Core architecture + 3 tools | ✅ Complete |
| **Phase 1** | Polish & Launch | ✅ Complete |
| **Phase 2** | Growth & new tools | 🚧 In Progress (~70%) |
| **Phase 3** | Scale to 100 tools | 📋 Planned |
| **Phase 4** | Ecosystem | 💡 Future |

```
MVP ████████████████████ 100%
P1  ████████████████████ 100%
P2  ██████████████░░░░░░  70%
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

### Tools (MVP launch)
- [x] **Media Optimizer** — WASM compression, WebP/JPEG/PNG/AVIF, batch ZIP
- [x] **Prompt Architect** — CO-STAR & RISEN, live preview, draft autosave
- [x] **Data Sanitizer** — PapaParse chunked CSV, dedupe, email/phone validation

### Dashboard
- [x] Hero section + privacy messaging (`Smart Utilities. 100% Private.`)
- [x] Tool card grid with badges, emoji, bookmark (★)
- [x] `Ctrl+K` / `Cmd+K` command palette

---

## ✅ Phase 1 — Polish & Launch (Complete)

**Goal:** Production-ready, professional finish, live on `omniutil.pro`  
**Timeline:** 1–2 weeks

### 1.1 UI/UX Unification — ✅ Complete

- [x] Shared `ToolLayout` component
- [x] Blue/dark theme on all tool pages
- [x] `Ctrl+K` / `Cmd+K` command palette
- [x] Remove `ToolPlaceholder`
- [x] Hydration fixes (`useLocalStorage`, Inter font)
- [x] Consistent loading, empty, and error states (`ToolStateWrapper.tsx`)

**Key files:** `ToolLayout.tsx`, `CommandPalette.tsx`, `ToolStateWrapper.tsx`, `FileDropzone.tsx`

### 1.2 Tool Enhancements — ✅ Complete

| Tool | Done | Remaining |
|------|------|-----------|
| **Media Optimizer** | AVIF, batch ZIP (`jszip`), before/after slider | — |
| **Prompt Architect** | CO-STAR, RISEN, RTCE, APE, template library (12 templates) | — |
| **Data Sanitizer** | CSV, Excel, dedupe, validation, column mapping, anonymization | — |

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
- [x] Google Search Console verification meta tag (`layout.tsx`)

**Live SEO routes:**

| Route | Purpose |
|-------|---------|
| `/sitemap.xml` | Google/Bing index |
| `/robots.txt` | Crawler rules |
| `/manifest.webmanifest` | PWA install |
| `/opengraph-image` | Social share preview |
| `/icon` | Favicon |
| `/apple-icon` | iOS home screen |

**Env var for production (Vercel):**
```bash
NEXT_PUBLIC_SITE_URL=https://www.omniutil.pro
```
> **Note:** Default canonical URL is `https://www.omniutil.pro`. Set the same value in Vercel Environment Variables for production builds.

### 1.4 Deployment & Launch — ✅ Complete

- [x] GitHub repository connected — [github.com/mmrobiulislam87/omniutil.pro](https://github.com/mmrobiulislam87/omniutil.pro)
- [x] Code pushed to `main` (`v0.4.0` — AI Background Remover + smart PDF layout)
- [x] Vercel production deploy — live at [www.omniutil.pro](https://www.omniutil.pro)
- [x] Custom domain: `omniutil.pro` (Vercel DNS, SSL active)
- [x] Public hero tagline — `Smart Utilities. 100% Private.`
- [x] Google Search Console — property verified (`https://www.omniutil.pro/`)
- [x] Sitemap submitted — `/sitemap.xml` processed (6 pages discovered)
- [x] Canonical URL default — `https://www.omniutil.pro` (`site.ts`, `.env.example`)
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://www.omniutil.pro` in Vercel env (mirror code default)
- [ ] Production smoke test checklist (see below)
- [ ] Request indexing for key URLs in GSC (home + 5 tools)

**Pre-launch smoke test:**
- [ ] Home, all 5 tool pages load
- [ ] Media Optimizer: compress + download + ZIP
- [ ] Prompt Architect: build + copy prompt
- [ ] Data Sanitizer: upload CSV + clean + export
- [ ] File to PDF: image/Excel → PDF with Auto layout
- [ ] AI Background Remover: upload → remove bg → download PNG
- [ ] `Ctrl+K` palette works
- [ ] `/sitemap.xml` and `/robots.txt` accessible
- [ ] OG preview valid (share link on Twitter/LinkedIn)

---

## Phase 2 — Growth

**Goal:** Increase traffic, retention, and tool count  
**Timeline:** 2–4 weeks

### Live tools (11 total)

| Tool | Route | Version |
|------|-------|---------|
| WASM Local Transcriber | `/audio-transcriber` | v0.8.0 |
| Visual Regex Builder | `/regex-builder` | v0.8.0 |
| Secure JWT Debugger | `/jwt-debugger` | v0.8.0 |
| SVG-to-Code Transformer | `/svg-to-code` | v0.7.0 |
| IMEI Checker & Device Lookup | `/imei-checker` | v0.6.1 |
| JSON Formatter & Validator | `/json-formatter` | v0.5.0 |
| AI Background Remover | `/bg-remover` | v0.4.0 |
| Media Optimizer | `/media-optimizer` | v0.2.4+ |
| Prompt Architect | `/prompt-architect` | v0.2.7+ |
| Data Sanitizer | `/data-sanitizer` | v0.2.8+ |
| File to PDF | `/file-to-pdf` | v0.3.1+ |

### 2.1 New Tools (Priority Queue)

| # | Tool | Category | Stack | Status |
|---|------|----------|-------|--------|
| 4 | **File to PDF** (Unicode / বাংলা) | Document | `pdf-lib` + Noto fonts | ✅ Live |
| 5 | **AI Background Remover** | Media | `@imgly/background-removal` + ONNX/WASM | ✅ Live |
| 6 | JSON Formatter & Validator | Dev | Pure JS | ✅ Live |
| 7 | PDF Merger / Splitter | Document | `pdf-lib` | 📋 |
| 8 | QR Code Generator | Utility | `qrcode` | 📋 |
| 9 | Color Palette Generator | Design | Canvas API | 📋 |
| 10 | Markdown → HTML | Dev | `marked` | 📋 |
| 11 | Password Generator | Security | Web Crypto API | 📋 |
| 12 | Base64 Encode/Decode | Dev | Native APIs | 📋 |

### 2.1b Elite Tools Pipeline (Dev Power Tools)

| Order | Tool | Stack | Status |
|-------|------|-------|--------|
| **6** | **SVG-to-Code Transformer** | `svgo/browser` + JSX codegen | ✅ Live |
| **7** | **Secure JWT & Crypto Debugger** | Web Crypto API | ✅ Live |
| **8** | **Visual Regex Builder** | Pure JS parser | ✅ Live |
| **9** | **WASM Local Transcriber** | `@huggingface/transformers` + Whisper | ✅ Live |

**Adding a new tool:**
1. Add entry to `src/lib/tools.ts` (auto-added to sitemap)
2. Create `src/app/[slug]/page.tsx` with `ToolLayout` + `buildToolMetadata()`
3. Add logic in `src/utils/[tool].ts`
4. Build UI in `src/components/[tool]/`

### 2.2 PWA & Performance
- [x] Web manifest + app icons (Phase 1.3)
- [x] Per-tool code splitting — AI Background Remover lazy-loads ONNX model on demand
- [ ] Service Worker — offline dashboard shell
- [ ] Lighthouse score 95+ (LCP, CLS, INP)
- [ ] Per-tool code splitting audit (remaining tools)
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

### v0.8.0 — Elite Tools Pipeline Complete (Jun 29, 2026)
- **JWT Debugger** (`/jwt-debugger`) — color-coded decode, HS256 Web Crypto verify
- **Visual Regex Builder** (`/regex-builder`) — live highlighting, flags, presets
- **WASM Local Transcriber** (`/audio-transcriber`) — Whisper tiny via Transformers.js

### v0.7.0 — SVG-to-Code Transformer (Jun 29, 2026)
- New tool: **SVG-to-Code Transformer** (`/svg-to-code`)
- SVGO browser optimization with size savings stats
- React TSX + Tailwind (`currentColor`, `h-6 w-6`) codegen
- Live preview, copy, and download

### v0.6.1 — IMEI Checker TAC Database (Jun 29, 2026)
- 22,529+ TAC device index with photos and specs (Osmocom + supplements)
- Auto-load local database; vivo Y02t and major brands covered

### v0.6.0 — IMEI Checker (Jun 29, 2026)
- New tool: IMEI validation + TAC device lookup (`/imei-checker`)

### v0.5.0 — JSON Formatter & Validator (Jun 29, 2026)
- New tool: **JSON Formatter & Validator** (`/json-formatter`)
- Pure `JSON.parse` / `JSON.stringify` — zero dependencies, instant client-side
- 2-space, 4-space, and minified output modes
- Syntax errors with line + column hints; one-click copy

### v0.4.0 — AI Background Remover + Smart PDF Layout (Jun 29, 2026)
- New tool: **AI Background Remover** (`/bg-remover`)
- On-device background removal via `@imgly/background-removal` (ONNX Runtime Web + WASM)
- Progress bar for model download + inference; transparent/white/black/custom background + HD PNG export
- Checkerboard preview for transparent backgrounds (`.checkboard-bg`)
- File to PDF: **Auto layout** — content-aware column widths, text wrapping, dynamic page width (no truncation)
- File to PDF: Portrait / Landscape / Auto orientation toggle
- Deployed to production — [www.omniutil.pro/bg-remover](https://www.omniutil.pro/bg-remover)

### v0.3.1 — File to PDF Orientation (Jun 29, 2026)
- Portrait and Landscape modes for spreadsheet/image PDF export
- Horizontal + vertical pagination for wide Excel tables

### v0.3.0 — File to PDF (Jun 29, 2026)
- New tool: Universal File to PDF (`/file-to-pdf`)
- Images (multi-merge), Excel/CSV tables, text files → one PDF
- Noto Sans + Noto Sans Bengali — full Unicode / বাংলা text rendering
- 100% client-side via `pdf-lib` + `@pdf-lib/fontkit`

### v0.2.8 — Column Anonymization (Jun 29, 2026)
- Data Sanitizer: hash, mask, redact, and pseudonym methods
- Per-column anonymization with sensitive-column auto-suggest
- Runs after dedupe/validation; stats show cells anonymized

### v0.2.7 — Prompt Template Library (Jun 29, 2026)
- 12 curated templates across Writing, Marketing, Development, Business, Research
- Category filters + framework-scoped view with “show all” toggle
- One-click load into framework fields with live preview

### v0.2.6 — RTCE & APE Frameworks (Jun 29, 2026)
- Prompt Architect: RTCE (Role, Task, Context, Examples) framework
- Prompt Architect: APE (Action, Purpose, Expectation) framework
- Four elite frameworks: CO-STAR, RISEN, RTCE, APE

### v0.2.5 — Excel Support (Jun 29, 2026)
- Data Sanitizer: `.xlsx`, `.xls`, `.xlsm` parsing via SheetJS (`xlsx`)
- Multi-sheet workbook selector
- Column mapping UI — include/exclude columns before clean + export

### v0.2.4 — Before/After Slider (Jun 29, 2026)
- Media Optimizer: interactive before/after comparison slider per result
- `BeforeAfterSlider` component with pointer + keyboard support
- `ProcessedImage` stores original preview URL for side-by-side compare

### v0.2.3 — Phase 1 Complete (Jun 29, 2026)
- `ToolStateWrapper` — shared loading, empty, and error states across all tools
- Canonical URL default aligned to `https://www.omniutil.pro`
- Phase 1 closed at 100%

### v0.2.2 — Launch (Jun 29, 2026)
- Live on Vercel — [www.omniutil.pro](https://www.omniutil.pro)
- Public hero tagline: `Smart Utilities. 100% Private.`
- Google Search Console verification + sitemap submitted (4 pages)
- Custom domain `omniutil.pro` with SSL

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
| ~~SEO (sitemap, OG)~~ ✅ | ~~AI Background Remover~~ ✅ |
| ~~Vercel deploy + domain~~ ✅ | Before/after image slider |
| ~~Google Search Console submit~~ ✅ | Excel support (Data Sanitizer) |
| ~~Excel support~~ ✅ | i18n (EN + BN) |
| ~~Data anonymization~~ ✅ | Plugin registry refactor |
| ~~AVIF + ZIP~~ ✅ | Plugin registry refactor |
| ~~File to PDF~~ ✅ | Smart PDF auto-layout |

| Low impact, low effort | Low impact, high effort |
|------------------------|-------------------------|
| Analytics (Plausible) | Browser extension |
| Per-tool OG images | CLI tool |
| Changelog page | Native mobile app |
| ~~Unified loading/empty states~~ ✅ | |

---

## Recommended Next Steps

1. **GSC follow-up** — Resubmit sitemap (now 7 URLs); request indexing for new tools
2. **Vercel env** — Set `NEXT_PUBLIC_SITE_URL=https://www.omniutil.pro` and redeploy
3. **Phase 2.1** — QR Code Generator ← **next**
4. **Phase 2.1** — PDF Merger / Splitter
5. **Production smoke test** — Run checklist for all 6 live tools

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
| Background removal | `@imgly/background-removal` (ONNX Runtime Web) |
| PDF generation | `pdf-lib` + `@pdf-lib/fontkit` + Noto fonts (CDN) |
| CSV / Excel parsing | `papaparse` + `xlsx` (SheetJS) |
| ZIP export | `jszip` |
| Forms | `react-hook-form` |
| Icons | `lucide-react` |
| State | React Context + LocalStorage |
| Hosting | Vercel (Edge) — production live |

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

- **GitHub:** https://github.com/mmrobiulislam87/omniutil.pro
- **Local dev:** `npm run dev` → http://localhost:3000
- **Production:** https://www.omniutil.pro
- **Sitemap:** https://www.omniutil.pro/sitemap.xml
- **Robots:** https://www.omniutil.pro/robots.txt
- **Search Console:** https://search.google.com/search-console (property: `https://www.omniutil.pro/`)

---

*This roadmap is a living document. Update checkboxes and phases as work ships.*
