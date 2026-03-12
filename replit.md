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