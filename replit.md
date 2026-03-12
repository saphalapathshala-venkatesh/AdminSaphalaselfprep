# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. Key capabilities include authentication, managing taxonomy, question banks, test series, flashcards, content library, coupons, XP rules, learner data, video management, and live class scheduling, along with analytics and reporting.

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
    - **Video Module**: Full CRUD for Videos with status lifecycle (DRAFT→UPLOADING→PROCESSING→READY→PUBLISHED→ARCHIVED), multi-provider support (Bunny/YouTube/Manual), HLS/playback URL management, course assignment, faculty assignment, encoding queue view, library card view, and course-grouped view. API: `/api/videos`, `/api/videos/[id]`.
    - **Live Classes Module**: Full CRUD for live sessions with scheduling, platform support (Zoom/YouTube Live), recording policy management, replay video linking, calendar view, faculty management, attendance page (platform integration placeholder), and recordings tracker. API: `/api/live-classes`, `/api/live-classes/[id]`.
    - **Course & Faculty Entities**: Reusable across both Video and Live Classes modules. API: `/api/courses`, `/api/courses/[id]`, `/api/faculty`, `/api/faculty/[id]`. Courses now carry 4 product-type booleans (`hasHtmlCourse`, `hasVideoCourse`, `hasPdfCourse`, `hasTestSeries`); at least one must be true (enforced in API + UI). Managed at `/admin/courses` with full CRUD, type-badge display, active toggle, and colour-coded checkboxes. Course-videos quick-create modal also includes type checkboxes (defaults to Video). Schema pushed to Neon; existing rows backfilled with `hasVideoCourse=true`.
    - **Content Flow Module**: Ordered sequence builder for Videos, PDFs, and Flashcard Decks within a given context (Course or Taxonomy node). Supports mixed-type ordering, Up/Down reordering with a Save Order action, Add Content side-panel modal with search across all three types, and Remove with automatic gap-close renumbering. API: `/api/content-flow` (GET+POST), `/api/content-flow/reorder` (PUT), `/api/content-flow/[id]` (PUT+DELETE). Page at `/admin/content-flow`.
    - **Course Content Builder**: Structured folder-tree + mixed content mapping system per course. Supports nested `CourseFolder` trees (create/rename/delete with force-move-up), `CourseContentItem` mappings for VIDEO/LIVE_CLASS/PDF/FLASHCARD_DECK (each item maps once via `@@unique[courseId,itemType,sourceId]`), unified sortOrder across folders+items within a context, conditional Add buttons driven by course product-type flags (`hasVideoCourse` → Video+LiveClass; `hasPdfCourse` → PDF; Flashcards always), contextual candidate filtering by `course.categoryId`, taxonomy cascade filters (subject/topic/subtopic) in Add panel, source-missing detection, and "Save Order" dirty-state bar. APIs: `/api/courses/[id]/content` (GET full tree), `/api/courses/[id]/folders` (GET+POST), `/api/courses/[id]/folders/[folderId]` (PUT rename, DELETE with ?force=true), `/api/courses/[id]/items` (POST add), `/api/courses/[id]/items/[itemId]` (PUT move-to-folder, DELETE remove), `/api/courses/[id]/reorder` (PUT unified reorder), `/api/courses/[id]/candidates` (GET filtered candidates). Page at `/admin/courses/[id]/content`. `CourseFolder` + `CourseContentItem` models added to Prisma schema and pushed to Neon.
    - **Sidebar MEDIA section**: Added between CONTENT and COMMERCE with Videos, Live Classes, and Content Flow links.
    - **Security & Performance**: Login rate limiting, `tenantId="default"` enforcement, health check endpoint, non-awaited audit logs, `keepalive` for logout, and instant skeleton loaders.
    - **Safety Checks Module** (`lib/safetyChecks.ts`): Central runtime guards — `isAdminRole` type-narrowing predicate, `safeUser` credential stripper, `assertNoCredentialsLeaked` dev-mode guard, `validateNewPassword` policy enforcer, `isPrismaSingletonActive` health probe. `requireRole()` in `lib/auth.ts` uses the `AdminRole` type from this module.
    - **Password Security**: All hashing/comparison uses `bcryptjs` (cost factor 10). `validateNewPassword` enforces minimum length and same-as-current prevention. Raw `bcrypt` package is not used anywhere.
    - **Rich Content Support**: `String` fields now store HTML, supporting base64 data URIs for images and `<span class="math-eq" data-latex="...">$$source$$</span>` for KaTeX-rendered equations.
    - **DOCX Import Pipeline**: Enhanced to preserve rich text formatting (bold, italic, underline, lists, tables), inline images (as base64), and group/passage structure from DOCX files.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Equation Rendering**: KaTeX