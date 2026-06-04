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
│   └── AppShell.tsx     — sidebar + mobile bottom nav
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

## Last Updated

2026-06-04 — Bug fix pass complete.
- Fixed JWT fallback secret vulnerability (middleware.ts, auth.ts)
- Fixed race conditions: transactions/balance, budget upsert, recurring processing all use db.batch()
- Fixed accounts PATCH to whitelist allowed fields
- Fixed recurring per-item error isolation
- Fixed dashboard timezone bug in monthly transaction filter
- Optimized health score budget loop (N+1 → single Map pass)
- Added noRecurring translation key (id.ts, en.ts)
- Replaced hardcoded strings with translation keys (goals, settings)
