# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. Built with Next.js 14, TypeScript, Prisma, and PostgreSQL, it provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. Key capabilities include authentication, managing taxonomy, question banks, test series, flashcards, content library, coupons, XP rules, and learner data, along with analytics and reporting.

## User Preferences
I prefer clear and direct communication. When making changes, please explain the "why" behind them, not just the "what." I prefer an iterative development approach, where features are built and reviewed in small, manageable increments. Before implementing any major architectural changes or introducing new dependencies, please ask for confirmation. Do not make changes to files outside the `app/`, `components/`, `lib/`, `prisma/`, `public/`, `styles/` directories.

## System Architecture

### UI/UX Decisions
The console utilizes a consistent brand palette with purple (`#7c3aed`) as the primary CTA color. Semantic colors are used for specific elements: blue for tab indicators, green for paid users, and cyan for net revenue. The dashboard features a styled "S" monogram logo. UI elements like tables, modals, and inputs are highly reusable, and the dashboard provides instant skeleton loaders and animated shimmer placeholders for improved perceived performance.

### Technical Implementations
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM v5
- **Authentication**: Session-based with httpOnly cookie `admin_session`, protected by middleware. Login uses a 3-phase state machine for a smooth UX. Audit logging on login is fire-and-forget for performance.
- **Validation**: Zod v4
- **Project Structure**: Organized into `app/` (pages, API routes), `components/` (UI, admin-specific), `lib/` (utilities, auth, Prisma client), `prisma/` (schema, seed, migrations), and `styles/`.
- **API Design**: RESTful API endpoints for all major entities (Taxonomy, Questions, Tests, Flashcards, Content, Products, Coupons, XP Rules, Learners, Analytics).
- **Core Features**:
    - **Admin Authentication**: Secure login/logout, session management, role-based access control (ADMIN, SUPER_ADMIN).
    - **Content Management**:
        - **Taxonomy**: Full CRUD with tree view.
        - **Question Bank**: Full CRUD, pagination, filters, duplicate detection (using content hash + similarity scoring), bulk edit, MCQ options.
        - **Imports**: CSV/DOCX upload, preview, validate, edit, revalidate, commit workflow for questions, with error reporting and taxonomy auto-creation.
        - **Test Series & Tests**: Full CRUD, section builder, question picker, validation panel, publish flow. Supports subsections, target question counts, and shared timer pools.
        - **Flashcards**: Deck and Card CRUD, reordering, cascading taxonomy, image support.
        - **Content Library**: HTML pages (CRUD with body editor) and PDF asset management (upload/manage).
    - **User & System Management**:
        - **Coupons & Product Builder**: Full CRUD for products and coupons, with purchase simulation.
        - **XP Rules**: CRUD for experience point rules, including rule history.
        - **Learners**: List with filters, detailed profile panels (XP, activity, entitlements), entitlement grant/revoke, status toggling.
        - **Analytics**: Dashboard KPIs, charts, tables, reports (attempts, XP, revenue, category performance) with CSV export and filtering.
    - **Security & Performance**: Login rate limiting, `tenantId="default"` enforcement, health check endpoint. Performance optimizations include non-awaited audit logs, `keepalive` for logout, and instant skeleton loaders.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon, with specific `DIRECT_URL` for migrations)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
## Category Enforcement & Governance (March 2026)

### Schema
- Added `categoryId String?` to `Test` model — migration `add_test_category` applied

### Category Enforcement (API)
- `POST /api/tests`: Accepts `categoryId`; auto-inherits from series if series has category; blocks 400 on mismatch
- `PUT /api/tests`: Same validation on update
- `DELETE /api/test-series`: Blocked with 400 if any published tests exist in the series
- `GET /api/questions`: Added `sourceTag` filter; added `_count: { testQuestions }` to include
- `DELETE /api/questions/[id]`: Returns `{ warning, usageCount, message }` if used in tests; requires `?force=true` to bypass

### Test Builder UI
- `categoryId` in form state; auto-populated when series is selected
- Inline red mismatch banner shown if category and series don't agree
- `hasSectionsManual` checkbox ("Multiple Sections") — decoupled from mode
- Category-based section presets dropdown (Banking, APPSC, AP Police, UPSC, SSC)
- Button wording: "Remove" on questions, "✕ Remove" on sections — never "Delete Question"

### Test Series UI
- Category is now required (validation + red-border on empty)
- Category column visible in the series list table
- Deletion blocked at API if published tests exist

### Question Bank UI
- Stats bar: Total in Bank, Showing (filtered), per-difficulty counts
- Source Tag filter added
- "In Tests" column — shows N tests badge or "—"
- Delete flow: usage-warning modal before force-delete
- Bulk Delete button — with confirmation modal showing force-delete implications

## Settings Menu (March 2026)

### Schema Changes
- **None required.** `AuditLog`, `User`, and `Session` models already contained everything needed.

### API Routes Added (`app/api/settings/`)
- `profile/route.ts` — GET current admin profile (name, email, role, lastLogin, activeSessions); PATCH to update display name
- `password/route.ts` — POST to change password (verifies current password via bcrypt, validates new ≥ 8 chars, hashes with bcryptjs)
- `audit-logs/route.ts` — GET with filters (action, actorId, entityType, date range, pagination 50/page); returns distinct actor list and action list for filter dropdowns
- `admins/route.ts` — GET list of admin users; POST create new admin (SUPER_ADMIN only); PATCH toggle isActive status (SUPER_ADMIN only, cannot self-modify)
- `payment/route.ts` — GET Razorpay config status from env vars (masked keys, live/test/not_configured mode)
- `sessions/route.ts` — DELETE to revoke all OTHER active sessions for current user (keeps current session alive)

### Settings Page (`app/admin/settings/page.tsx`)
Fully tabbed client component with 6 sections:
1. **Profile & Security** — display name edit (inline), read-only email/role/joined, last login, active sessions, change password form (current + new + confirm, bcrypt-verified)
2. **Payments** — Razorpay status badge (live/test/not_configured), masked keyId/secret/webhook, guidance text; Cashfree staged placeholder
3. **Audit Logs** — filterable table (action, admin, module, date range); paginated 50/page; color-coded action badges (red=delete, green=create, blue=auth, yellow=update, purple=publish)
4. **Admin Access** — list all admins with role/status/joined; SUPER_ADMIN can enable/disable others and create new accounts with temporary password
5. **Platform** — read-only environment overview; contact details env var guidance
6. **Danger Zone** — Revoke All Other Sessions with two-step confirmation; red-themed isolation from other sections
