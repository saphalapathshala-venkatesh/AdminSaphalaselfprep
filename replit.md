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
  admin/dashboard/page.tsx   - Dashboard (placeholder)
  admin/taxonomy/page.tsx    - Taxonomy (full CRUD with tree view)
  admin/question-bank/       - Question Bank (full CRUD with filters, bulk edit, duplicate detection)
  admin/imports/             - Imports (placeholder)
  admin/test-series/         - Test Series (full CRUD with search, pricing, publish toggle)
  admin/tests/               - Tests (full builder with sections, question picker, validation, publish)
  admin/flashcards/          - Flashcards (placeholder)
  admin/content-library/     - Content Library (placeholder)
  admin/coupons/             - Coupons (placeholder)
  admin/xp-rules/            - XP Rules (placeholder)
  admin/learners/            - Learners (placeholder)
  admin/analytics/           - Analytics (placeholder)
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
  api/flashcards/route.ts    - Flashcards API (stub)
  api/content-pages/route.ts - Content Pages API (stub)
  api/pdf-assets/route.ts    - PDF Assets API (stub)
  api/products/route.ts      - Products API (stub)
  api/coupons/route.ts       - Coupons API (stub)
  api/xp-rules/route.ts      - XP Rules API (stub)
  api/learners/route.ts      - Learners API (stub)
  api/analytics/route.ts     - Analytics API (stub)
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
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run migrations
- `npm run seed` - Seed admin user (prisma db seed)

## Auth Details
- Cookie: `admin_session` (httpOnly, secure in prod, sameSite=lax)
- Session expires after 7 days
- Only ADMIN and SUPER_ADMIN roles can access /admin/*
- Login accepts email or mobile + password

## Seed Credentials
- Set via environment variables: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD
- Both must be set before running seed; no hardcoded fallbacks
- Seed is idempotent: if user exists, it does nothing (no overwrite)

## Recent Changes
- 2026-02-21: Initial project setup with full auth, middleware, admin layout, and placeholder pages
- 2026-02-21: Updated to full PRD schema (28 models), added API route stubs for all entities, updated audit log to match new schema fields
- 2026-02-21: Implemented full Taxonomy module (CRUD + tree view UI + audit logging + force delete for SUPER_ADMIN), updated middleware role check
- 2026-02-21: Implemented full Question Bank module (CRUD + pagination + filters + duplicate detection + near-duplicate warning + bulk edit + MCQ options + audit logging)
- 2026-02-21: Locked SUPER_ADMIN seed to env vars only (no hardcoded credentials), updated .env.example
- 2026-02-21: Implemented full Import System module (CSV + DOCX upload, preview/validate/edit/revalidate/commit workflow, inline row editing, error report CSV download, taxonomy auto-creation, duplicate blocking, audit logging)
- 2026-02-21: Implemented full Test Series + Tests Builder module (CRUD, sections editor, question picker, validation panel, publish flow with locked rules, audit logging)
