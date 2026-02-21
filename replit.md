# Saphala Self Prep Admin Console

## Overview
Admin-only console for Saphala Self Prep platform. Built with Next.js 14 (App Router), TypeScript, Prisma ORM, and PostgreSQL.

## Current State
- Admin authentication fully functional (login/logout/session management)
- Middleware protection on all /admin/* routes
- 13 admin section placeholder pages with sidebar navigation
- Seeded SUPER_ADMIN user

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
  admin/taxonomy/page.tsx    - Taxonomy (placeholder)
  admin/question-bank/       - Question Bank (placeholder)
  admin/imports/             - Imports (placeholder)
  admin/test-series/         - Test Series (placeholder)
  admin/tests/               - Tests (placeholder)
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
lib/
  prisma.ts                  - Prisma singleton
  auth.ts                    - Auth helpers (getSessionUser, requireAdmin, requireRole)
  audit.ts                   - Audit log writer
  validators/auth.ts         - Zod login schema
prisma/
  schema.prisma              - Database schema
  seed.ts                    - Seed script for SUPER_ADMIN
middleware.ts                - Route protection for /admin/*
```

## Key Commands
- `npm run dev` - Start dev server on port 5000
- `npx prisma migrate dev` - Run migrations
- `npx tsx prisma/seed.ts` - Seed admin user

## Auth Details
- Cookie: `admin_session` (httpOnly, secure in prod, sameSite=lax)
- Session expires after 7 days
- Only ADMIN and SUPER_ADMIN roles can access /admin/*
- Login accepts email or mobile + password

## Seed Credentials
- Email: admin@saphala.com
- Password: admin123 (set via ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD env vars)

## Recent Changes
- 2026-02-21: Initial project setup with full auth, middleware, admin layout, and placeholder pages
