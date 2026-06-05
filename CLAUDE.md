@AGENTS.md

# Jaga Uang — Financial Terminal

Personal financial management app with semi-matrix aesthetic. 100% private, multi-device via Turso cloud SQLite.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — matrix theme tokens in `src/app/globals.css`
- **Drizzle ORM** + **Turso** (LibSQL) — `src/lib/db/`
- **Framer Motion** — page transitions, animated progress rings
- **Recharts** — financial charts (dark matrix theme)
- **bcryptjs** + **jose** — password auth with httpOnly JWT cookie
- Custom bilingual i18n (ID/EN) — `src/lib/i18n/`

## Project Structure

```
src/
├── app/
│   ├── (auth)/          — login, setup pages (no sidebar)
│   ├── (app)/           — main app with AppShell sidebar
│   │   ├── dashboard/   — /dashboard
│   │   ├── transactions/ — /transactions
│   │   ├── accounts/    — /accounts
│   │   ├── reports/     — /reports
│   │   ├── budget/      — /budget
│   │   ├── goals/       — /goals
│   │   └── settings/    — /settings
│   └── api/             — REST API routes
├── components/
│   ├── matrix/          — MatrixRain, GlitchText, NeonCard, CounterNumber, TerminalModal
│   ├── AppShell.tsx     — sidebar + mobile bottom nav + QuickAddFAB mount
│   └── QuickAddFAB.tsx  — floating quick-add button (all app pages)
├── lib/
│   ├── db/schema.ts     — Drizzle table definitions
│   ├── db/index.ts      — Turso client singleton
│   ├── auth.ts          — JWT sign/verify
│   ├── i18n/            — id.ts + en.ts translations
│   └── utils.ts         — formatIDR, formatDate, health helpers
├── hooks/
│   └── useLanguage.tsx  — language context (ID/EN toggle)
├── middleware.ts         — JWT auth guard for all protected routes
└── types/index.ts       — shared TypeScript interfaces
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:push      # Push schema to Turso (requires .env.local)
npm run db:studio    # Drizzle Studio (DB browser)
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token
JWT_SECRET=your-random-32-char-secret
```

## First-Time Setup

1. Create Turso DB: `turso db create jaga-uang`
2. Get credentials: `turso db show jaga-uang --url` + `turso db tokens create jaga-uang`
3. Set env vars in `.env.local`
4. Run `npm run db:push` to initialize schema
5. Start with `npm run dev`
6. Visit `http://localhost:3000` → redirected to `/setup` → set password
7. Log in and start using

## Matrix Design System

All design tokens are in `src/app/globals.css` under `@theme inline { ... }`.

Key CSS classes:
- `.matrix-panel` — background panel
- `.matrix-card` — hover card with glow effect
- `.matrix-input` — terminal-style input
- `.matrix-btn` / `.matrix-btn-solid` / `.matrix-btn-danger` — buttons
- `.matrix-table` — table with green borders
- `.matrix-label` — uppercase monospace label
- `.matrix-badge` — colored badge chip
- `.matrix-progress` / `.matrix-progress-bar` — progress bar
- `.text-glow` / `.text-glow-red` / `.text-glow-yellow` / `.text-glow-cyan` — neon text glow
- `.glow-box` / `.glow-box-hover` — box shadow glow
- `.glitch` — CSS glitch animation (needs `data-text` attribute)
- `.cursor-blink` — terminal blinking cursor

## Key Patterns

### Adding a new page
1. Create `src/app/(app)/new-page/page.tsx`
2. Add nav item in `src/components/AppShell.tsx` `NAV_ITEMS`
3. Add translations in `src/lib/i18n/id.ts` and `en.ts`

### API routes
All in `src/app/api/`. Auth is handled by middleware — routes don't need to verify JWT manually.

### Database changes
1. Edit `src/lib/db/schema.ts`
2. Run `npm run db:push` (Turso applies changes directly, no migrations needed for push)

### Adding translations
Add keys to both `src/lib/i18n/id.ts` and `src/lib/i18n/en.ts` at the same path.
Access via `const { t } = useLanguage()` in client components.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET)
4. Deploy — auto-deploys on push to main

## Security Notes

- Single-user app: one password stored as bcrypt hash in `settings` table
- JWT stored in httpOnly cookie (not accessible via JS)
- Middleware checks JWT on every request to protected routes
- No public API endpoints except `/api/auth/*`, `/api/setup`

## Security Notes (Detail)

- `JWT_SECRET` env var is **required** — app throws at startup if missing (no fallback)
- `PATCH /api/accounts/[id]` only accepts: `name`, `type`, `icon`, `color`, `description` — balance/isActive cannot be bypassed
- Transaction insert + balance update are atomic via `db.batch()`
- Budget upsert (delete+insert) is atomic via `db.batch()`
- Recurring rule processing: each rule runs in its own try/catch — one failure won't block others

## New API Routes (Feature Pass #1)

- `GET /api/transactions/check-duplicate` — duplicate detection: `?amount=&description=&date=&excludeId=`, returns matching transactions within ±3 days
- `GET /api/export/csv` — CSV/Excel export: `?format=csv|xlsx&startDate=&endDate=&type=`, ikut filter aktif
- `GET /api/networth` — net worth history: `?startDate=&endDate=`, returns `{ snapshots, accounts }` calculated from transaction history
- `GET /api/export` — original JSON full-dump (unchanged)

## New Dependencies

- `xlsx` (SheetJS) — Excel export via `/api/export/csv?format=xlsx`

## ARIA AI Helper (/ai)

Full-page AI assistant powered by Claude Haiku with **Fallout RobCo Industries terminal aesthetic** (amber phosphor CRT). Architecture:
- `src/app/(app)/ai/page.tsx` — Fallout terminal UI: two-column layout (desktop), mobile compact header, typewriter boot sequence (8 RobCo-style lines), terminal-line messages (no bubbles), 4 quick-action buttons, amber color palette
- `src/components/AriaFace.tsx` — SVG face inside amber CRT monitor frame: corner brackets, bezel labels, 4 signal bars, heavy phosphor scanlines, amber `#FFB000` accent color (warning=red, sad=cyan still apply)
- `src/app/api/ai/context/route.ts` — GET, aggregates all financial data (accounts, transactions, budgets, goals, categories) into a single context object for the AI
- `src/app/api/ai/chat/route.ts` — POST, streams Claude Haiku via SSE; system prompt uses Fallout terminal voice ("DATA DITEMUKAN:", "ANALISIS SELESAI.", "PERINGATAN:", "REKOMENDASI SISTEM:"), refers to user as "operator"

**Color scope**: Amber theme is scoped to `/ai` page only — all other pages remain matrix-green. New keyframes in `globals.css`: `crt-flicker`, `phosphor-pulse`, `type-cursor`, plus `.aria-amber-glow`, `.aria-crt-flicker`, `.aria-phosphor-pulse` utility classes.

**Requires `ANTHROPIC_API_KEY`** in `.env.local` — app works without it but AI responses will fail.

Transaction confirmation flow: AI embeds `<transaction_confirm>{...}</transaction_confirm>` in response → UI shows confirm card (amber-styled) → on confirm, calls existing `/api/transactions` POST (atomic, same as manual entry).

Expression detection: keywords in AI response text automatically set face expression. `window.dispatchEvent(new Event('transaction:added'))` fired after AI-confirmed transaction.

AI context includes: accounts (id/name/type/balance/icon), recent 20 transactions, this-month transactions (up to 200 for budget calc), budget with % spent, goals with progress, top-5 expense categories, all categories (for transaction creation), netWorth/monthIncome/monthExpense/savingsRate.

## QuickAddFAB Pattern

`QuickAddFAB` is mounted inside `AppShell` so it appears on all app pages. It dispatches `window.dispatchEvent(new Event('transaction:added'))` after a successful save. Pages that show transactions should listen for this event and reload data:
```ts
useEffect(() => {
  const handler = () => load()
  window.addEventListener('transaction:added', handler)
  return () => window.removeEventListener('transaction:added', handler)
}, [load])
```

## Last Updated

2026-06-05 — Feature pass #3: ARIA Fallout Terminal UI Redesign.
- Redesigned /ai page with Fallout RobCo Industries amber phosphor CRT aesthetic
- AriaFace.tsx: amber CRT monitor frame with corner brackets, signal bars, bezel labels, heavier scanlines
- page.tsx: two-column desktop layout, mobile compact header with scaled avatar, typewriter boot sequence (8 lines ~22ms/char), terminal-line messages (no bubbles), 4 Fallout-style quick action buttons
- globals.css: added crt-flicker, phosphor-pulse, type-cursor keyframes + aria-amber-glow utility class
- api/ai/chat: updated system prompt to Fallout terminal voice ("operator", terminal phrases)
- Amber palette (#FFB000) scoped to /ai only — rest of app stays matrix-green

2026-06-05 — Feature pass #2: ARIA AI Helper complete.
- Added ARIA AI Helper page (/ai) — full-page chat with boot sequence animation
- Added AriaFace.tsx — SVG human-like face with 7 expressions, natural blink, pupil darting, CRT scanline overlay
- Added /api/ai/context — aggregates all financial data for AI context
- Added /api/ai/chat — streaming Claude Haiku via SSE with financial system prompt
- Added transaction confirmation flow — AI proposes, user confirms, uses existing atomic /api/transactions POST
- Added Bot icon to sidebar nav + mobile bottom nav (replaces reports in mobile bottom nav)
- Added ANTHROPIC_API_KEY to .env.example

2026-06-05 — Feature pass #1 complete.
- Added Quick-Add FAB (`QuickAddFAB.tsx`) — floating button on all pages, spring-animated panel, toast on save
- Added date range filter to transactions page — preset chips (Today/7d/This Month/Last Month/Custom) + summary bar
- Added duplicate detection — debounced check in TransactionForm and QuickAddFAB, yellow warning inline
- Added CSV/Excel export — `/api/export/csv`, dropdown in transactions header, respects active filters
- Added Net Worth History — `/api/networth` API + tab in Reports page (area chart + account breakdown) + sparkline in Dashboard
- Added `xlsx` dependency for Excel export

2026-06-05 — Bug fix pass #2 complete.
- Fixed `step="1000"/"10000"` on all number inputs (transactions, accounts, budget, goals) — values are now unrestricted
- Fixed Goals "Add Funds" flow: now deducts from selected account + creates transaction record atomically
- Fixed transfer API (transfers/route.ts) to use db.batch() — was not atomic before
- Fixed transaction PATCH/DELETE APIs to use db.batch() — were not atomic before
- Fixed timezone bug in getToday/getMonthStart/getMonthEnd/addMonths (utils.ts) — use local date instead of UTC
- Fixed addMonths month-end overflow (Jan 31 + 1 = Feb 28, not Mar 3)
- Fixed dashboard monthly stats: now fetches full month data separately from recent 10 transactions
- Fixed transfer form: from/to dropdowns now filter out each other's selection
- Added translation keys: transactions.requiredFields/saveFailed, accounts.deactivateConfirm/sameAccountError, goals.deleteConfirm/fromAccount/insufficientBalance/fundAdded
- Added "Tabungan" default expense category to DEFAULT_CATEGORIES
