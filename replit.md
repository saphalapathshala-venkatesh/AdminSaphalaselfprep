# Saphala Self Prep Admin Console

## Overview
Admin-only console for Saphala Self Prep platform. Built with Next.js 14 (App Router), TypeScript, Prisma ORM, and PostgreSQL.

## Current State
- Admin authentication fully functional (login/logout/session management)
- Middleware protection on all /admin/* routes
- 13 admin section placeholder pages with sidebar navigation
- Seeded SUPER_ADMIN user
- Full PRD database schema with 28 tables migrated and active

## Architecture
- **Framework**: Next.js 14 App Router
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM (v5)
- **Auth**: Session-based with httpOnly cookie `admin_session`
- **Validation**: Zod v4

## Project Structure
```
app/
  (public)/login/page.tsx    - Login page
  admin/layout.tsx           - Admin layout with sidebar
  admin/dashboard/page.tsx   - Dashboard (full: KPIs, charts, tables, quick actions, filters)
  admin/taxonomy/page.tsx    - Taxonomy (full CRUD with tree view)
  admin/question-bank/       - Question Bank (full CRUD with filters, bulk edit, duplicate detection)
  admin/imports/             - Imports (placeholder)
  admin/test-series/         - Test Series (full CRUD with search, pricing, publish toggle)
  admin/tests/               - Tests (full builder with sections, question picker, validation, publish)
  admin/flashcards/          - Flashcards (full CRUD with deck list, card table, reorder, cascading taxonomy)
  admin/content-library/     - Content Library (full: HTML pages CRUD + PDF upload/manage, two-tab UI)
  admin/coupons/             - Coupons & Product Builder (full CRUD, two-tab UI, simulate purchase)
  admin/xp-rules/            - XP Rules (full: rule table, edit modal, history modal)
  admin/learners/            - Learners (full: list with filters, profile panel with tabs, entitlement controls)
  admin/analytics/           - Analytics (full: reports with tabs, CSV export, date filters)
  admin/settings/            - Settings (placeholder)
  api/auth/login/route.ts    - POST login
  api/auth/logout/route.ts   - POST logout
  api/auth/me/route.ts       - GET current user
  api/taxonomy/route.ts      - Taxonomy API (full CRUD: GET/POST/PUT/DELETE)
  api/questions/route.ts     - Questions API (GET paginated+filtered, POST with duplicate detection)
  api/questions/[id]/route.ts - Questions API (PUT update, DELETE)
  api/questions/bulk/route.ts - Questions API (PUT bulk edit)
  api/imports/route.ts       - Imports API (full: preview/validate/revalidate/commit/row-edit)
  api/test-series/route.ts   - Test Series API (full CRUD: GET/POST/PUT/DELETE)
  api/tests/route.ts         - Tests API (full CRUD: GET/POST/PUT/DELETE)
  api/tests/[id]/route.ts    - Tests API (GET single test with sections + questions)
  api/tests/[id]/validate/   - Tests API (POST validation check)
  api/tests/[id]/publish/    - Tests API (POST publish with validation)
  api/tests/[id]/unpublish/  - Tests API (POST unpublish)
  api/flashcards/decks/route.ts       - Flashcard Decks API (GET list, POST create)
  api/flashcards/decks/[id]/route.ts  - Flashcard Deck API (PUT update, DELETE)
  api/flashcards/decks/[id]/cards/    - Flashcard Cards API (GET list, POST create)
  api/flashcards/decks/[id]/reorder/  - Flashcard Reorder API (PUT reorder cards)
  api/flashcards/cards/[id]/route.ts  - Flashcard Card API (PUT update, DELETE)
  api/content-pages/route.ts      - Content Pages API (GET paginated, POST create)
  api/content-pages/[id]/route.ts - Content Pages API (GET single, PUT update, DELETE)
  api/pdf-assets/route.ts         - PDF Assets API (GET paginated, POST multipart upload)
  api/pdf-assets/[id]/route.ts    - PDF Assets API (PUT update, DELETE with file cleanup)
  api/products/route.ts                    - Products API (GET/POST/PUT/DELETE)
  api/products/[id]/simulate-purchase/     - Simulate Purchase API (POST with coupon validation)
  api/coupons/route.ts                     - Coupons API (GET/POST/PUT/DELETE)
  api/coupons/[id]/usage/route.ts          - Coupon Usage API (GET usage stats)
  api/xp-rules/route.ts      - XP Rules API (GET with auto-seed, PUT update)
  api/xp-rules/history/route.ts - XP Rules History API (GET audit log entries)
  api/learners/route.ts      - Learners API (GET paginated with XP/activity/entitlements)
  api/learners/[id]/route.ts - Learner Profile API (GET full profile)
  api/learners/[id]/entitlements/route.ts - Entitlement Grant/Revoke API (PUT, SUPER_ADMIN only)
  api/learners/[id]/status/route.ts      - Learner Status API (PUT active/inactive)
  api/analytics/dashboard/route.ts - Dashboard API (KPIs, charts, tables with filters)
  api/analytics/report/route.ts   - Report API (attempts, xp, revenue, category-performance)
  api/analytics/export/route.ts   - CSV Export API (download reports as CSV)
  api/audit/route.ts         - Audit API (stub)
components/
  ui/                        - Reusable UI atoms (tables, modal, inputs)
  admin/                     - Sidebar, header, KPI cards, chart wrappers
lib/
  prisma.ts                  - Prisma singleton
  auth.ts                    - Auth helpers (getSessionUser, getSessionUserFromRequest, requireAdmin, requireRole)
  audit.ts                   - Audit log writer
  questionHash.ts            - Content hash + similarity scoring for duplicate detection
  validators/auth.ts         - Zod login schema
prisma/
  schema.prisma              - Full PRD database schema (28 models)
  seed.ts                    - Seed script for SUPER_ADMIN
  migrations/                - Database migration files
middleware.ts                - Route protection for /admin/*
styles/                      - Stylesheets
```

## Database Models (28 tables)
- **Identity**: User, Session
- **Entitlements**: UserEntitlement
- **Taxonomy**: Category, Subject, Topic, Subtopic
- **Question Bank**: Question, QuestionOption
- **Imports**: ImportJob, ImportRow
- **Tests**: TestSeries, Test, TestSection, TestQuestion
- **Attempts**: Attempt, AttemptAnswer
- **Flashcards**: FlashcardDeck, FlashcardCard
- **Content**: ContentPage, PdfAsset
- **Products**: ProductPackage
- **Coupons**: Coupon
- **XP System**: XpRule, XpEvent, XpLedgerEntry
- **Revenue**: Purchase
- **Audit**: AuditLog

## Key Commands
- `npm run dev` - Start dev server on port 5000
- `npm run build` - Prisma generate + Next.js build (no migrations at build time)
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run migrations (dev)
- `npm run seed` - Seed admin user (prisma db seed)
- `npm run db:setup` - Full DB setup: generate + migrate deploy + seed
- `npm run db:migrate:deploy` - Deploy pending migrations (manual only)
- `npm run db:migrate:status` - Check migration status
- `npm run db:seed` - Seed admin user

## Fix Prisma P3009 / Failed Migration (One-time)

If you see error P3009 ("migrate found failed migrations"), use one of these options:

**Option A (recommended):** Mark the failed migration as resolved:

```bash
# If the schema IS correctly applied in the DB already:
npx prisma migrate resolve --applied 20260221_prd_schema_init

# OR if you want to roll it back and re-apply:
npx prisma migrate resolve --rolled-back 20260221_prd_schema_init
```

Then run:
```bash
npx prisma migrate deploy
npx prisma db seed
```

**Option B:** Create a fresh Neon branch (schema-only), update `DATABASE_URL` and `DIRECT_URL` on Vercel, redeploy, then run:
```bash
npx prisma migrate deploy
npx prisma db seed
```

## Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required always; Neon pooled URL is fine for runtime)
- `DIRECT_URL` - Neon direct (non-pooled) connection URL; required **only** for migrations (`prisma migrate deploy`), not needed for dev/build/runtime
- `ADMIN_SEED_EMAIL` - Email for SUPER_ADMIN seed user
- `ADMIN_SEED_PASSWORD` - Password for SUPER_ADMIN seed user
- `BOOTSTRAP_KEY` - Secret key for /api/admin/bootstrap endpoint
- `ENFORCE_NEON_ONLY` - Set to "true" to block non-Neon DB URLs (auto-enabled on Vercel)

### Migration Commands (require DIRECT_URL for Neon)
```bash
npx prisma migrate resolve --applied 20260221_prd_schema_init
npx prisma migrate deploy
npx prisma db seed
```

## Production Bootstrap
To seed the SUPER_ADMIN user in a fresh Neon DB when deploying to Vercel:
```
curl -X POST https://<domain>/api/admin/bootstrap -H "x-bootstrap-key: <BOOTSTRAP_KEY>"
```

## Health Check
- Endpoint: `GET /api/health`
- Returns: `{ ok, timestamp, db, dbHost, dbName, env }`
- dbHost shows the database hostname (no secrets exposed)

## Auth Details
- Cookie: `admin_session` (httpOnly, secure in prod, sameSite=lax)
- Session expires after 7 days
- Only ADMIN and SUPER_ADMIN roles can access /admin/*
- Login accepts email or mobile + password

## Seed Credentials
- Set via environment variables: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD
- Both must be set before running seed; no hardcoded fallbacks
- Seed is idempotent: if user exists, it does nothing (no overwrite)

## Shared Design Tokens
- `lib/adminStyles.ts` — Brand palette (`BRAND`), shared button styles (`adminBtn`), card style (`adminCard`), table styles (`adminTable`)
- Brand primary color: `#7c3aed` (purple), used across all admin primary CTAs
- Semantic colors preserved: blue `#2563eb` for tab indicators/links, green for paid users, cyan for net revenue
- Logo: styled "S" monogram in dashboard hero (no external image dependency)

## Auth UX Performance Notes
- Login page uses a 3-phase state machine (`idle → submitting → redirecting`) — the button NEVER reverts to "Sign In" after success
- Login API: `writeAuditLog` is fire-and-forget (not awaited) to remove it from the critical response path
- Logout: `fetch("/api/auth/logout", { keepalive: true })` fires without await; `router.replace("/login")` is called immediately — zero wait time
- Dashboard: renders skeleton loaders instantly on mount; KPI cards, charts, and tables all have animated shimmer placeholders while data loads
- Dev timing logs: `console.debug("[Auth] ...")` lines in login page + layout for diagnosing delays (removable when done)
- Root cause of original delay: (1) `finally { setLoading(false) }` bug caused button flicker; (2) middleware HTTP fetch to `/api/auth/me` on every nav; (3) awaited audit log on login; (4) awaited logout API before redirect

## Recent Changes
- 2026-02-21: Initial project setup with full auth, middleware, admin layout, and placeholder pages
- 2026-02-21: Updated to full PRD schema (28 models), added API route stubs for all entities, updated audit log to match new schema fields
- 2026-02-21: Implemented full Taxonomy module (CRUD + tree view UI + audit logging + force delete for SUPER_ADMIN), updated middleware role check
- 2026-02-21: Implemented full Question Bank module (CRUD + pagination + filters + duplicate detection + near-duplicate warning + bulk edit + MCQ options + audit logging)
- 2026-02-21: Locked SUPER_ADMIN seed to env vars only (no hardcoded credentials), updated .env.example
- 2026-02-21: Implemented full Import System module (CSV + DOCX upload, preview/validate/edit/revalidate/commit workflow, inline row editing, error report CSV download, taxonomy auto-creation, duplicate blocking, audit logging)
- 2026-02-21: Implemented full Test Series + Tests Builder module (CRUD, sections editor, question picker, validation panel, publish flow with locked rules, audit logging)
- 2026-02-21: Implemented full Flashcards module (Deck CRUD, Card CRUD, reorder with transaction, cascading taxonomy, publish toggle, image URL support, audit logging for all actions)
- 2026-02-21: Implemented full Content Library module (HTML pages CRUD with body editor/preview, PDF upload/manage with file storage, two-tab UI, cascading taxonomy, publish toggle, audit logging)
- 2026-02-21: Implemented full Product Builder + Coupons module (Product CRUD, Coupon CRUD with usage analytics, simulate purchase with coupon validation, two-tab UI, 7 audit actions)
- 2026-02-21: Implemented full XP Rule Engine + Learners module (XP rules CRUD with auto-seed defaults, rule history, learner list with XP/activity/entitlements, profile panel with 4 tabs, entitlement grant/revoke, status toggle, 4 audit actions)
- 2026-02-21: Implemented full Dashboard + Analytics module (dashboard with KPIs/charts/tables/quick-actions, analytics with 4 report types + CSV export, date/learner/stream filters)
- 2026-02-21: Production hardening: tenantId="default" enforced on all entitlement writes, login rate limiting (5/60s), /api/health endpoint, cookie security confirmed
- 2026-02-22: Neon-only DB enforcement (guards in lib/prisma.ts + lib/env.ts, active on Vercel/ENFORCE_NEON_ONLY), bootstrap endpoint, health endpoint with dbHost/dbName
- 2026-02-22: Production stabilization: removed build-time migrations (P3018 fix), added directUrl to schema, added db-init runtime guard, migrations now manual-only via db:setup
