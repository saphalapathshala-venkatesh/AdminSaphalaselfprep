# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. Key capabilities include authentication, managing taxonomy, question banks, test series, flashcards, content library, coupons, XP rules, and learner data, along with analytics and reporting.

## User Preferences
I prefer clear and direct communication. When making changes, please explain the "why" behind them, not just the "what." I prefer an iterative development approach, where features are built and reviewed in small, manageable increments. Before implementing any major architectural changes or introducing new dependencies, please ask for confirmation. Do not make changes to files outside the `app/`, `components/`, `lib/`, `prisma/`, `public/`, `styles/` directories.

## System Architecture

### UI/UX Decisions
The console utilizes a consistent brand palette with purple (`#7c3aed`) as the primary CTA color and semantic colors for specific elements (blue for tab indicators, green for paid users, cyan for net revenue). The dashboard features a styled "S" monogram logo. UI elements like tables, modals, and inputs are highly reusable, and the dashboard provides instant skeleton loaders and animated shimmer placeholders for improved perceived performance.

### Technical Implementations
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM v5
- **Authentication**: Session-based with httpOnly cookie, protected by middleware. Login uses a 3-phase state machine with fire-and-forget audit logging.
- **Validation**: Zod v4
- **Project Structure**: Organized into `app/` (pages, API routes), `components/` (UI, admin-specific), `lib/` (utilities, auth, Prisma client), `prisma/` (schema, seed, migrations), and `styles/`.
- **API Design**: RESTful API endpoints for all major entities.
- **Core Features**:
    - **Admin Authentication**: Secure login/logout, session management, role-based access control (ADMIN, SUPER_ADMIN).
    - **Content Management**: Full CRUD for Taxonomy (tree view), Question Bank (pagination, filters, duplicate detection, bulk edit, imports with CSV/DOCX upload), Test Series & Tests (section builder, question picker, publish flow, shuffle controls), Flashcards (deck/card CRUD, reordering, image support), and Content Library (HTML pages, PDF asset management).
    - **User & System Management**: Full CRUD for Coupons & Product Builder, XP Rules (with history), Learners (profile panels, entitlements, status toggling), and Analytics (KPIs, charts, reports with CSV export).
    - **Security & Performance**: Login rate limiting, `tenantId="default"` enforcement, health check endpoint, non-awaited audit logs, `keepalive` for logout, and instant skeleton loaders.
    - **Rich Content Support**: `String` fields now store HTML, supporting base64 data URIs for images and `<span class="math-eq" data-latex="...">$$source$$</span>` for KaTeX-rendered equations.
    - **DOCX Import Pipeline**: Enhanced to preserve rich text formatting (bold, italic, underline, lists, tables), inline images (as base64), and group/passage structure from DOCX files.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Equation Rendering**: KaTeX