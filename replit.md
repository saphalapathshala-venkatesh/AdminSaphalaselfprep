# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. The project aims to provide a robust, scalable, and intuitive platform for educational content delivery and management.

## User Preferences
I prefer clear and direct communication. When making changes, please explain the "why" behind them, not just the "what." I prefer an iterative development approach, where features are built and reviewed in small, manageable increments. Before implementing any major architectural changes or introducing new dependencies, please ask for confirmation. Do not make changes to files outside the `app/`, `components/`, `lib/`, `prisma/`, `public/`, `styles/` directories.

## System Architecture

### UI/UX Decisions
The console uses a consistent brand palette with purple as the primary CTA color and semantic colors for specific elements. It features a styled "S" monogram logo and utilizes reusable UI components like tables, modals, and inputs. The dashboard incorporates instant skeleton loaders and animated shimmer placeholders for improved perceived performance.

### Technical Implementations
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma ORM v5
- **Authentication**: Session-based with httpOnly cookie, protected by middleware, and a 3-phase state machine for login with audit logging.
- **Validation**: Zod v4
- **Project Structure**: Organized into `app/` (pages, API routes), `components/` (UI, admin-specific), `lib/` (utilities, auth, Prisma client), `prisma/` (schema, seed, migrations), and `styles/`.
- **API Design**: RESTful API endpoints for all major entities.
- **Core Features**:
    - **Admin Authentication**: Secure login/logout, session management, and role-based access control.
    - **Content Management**: Full CRUD for Taxonomy, Question Bank, Test Series & Tests, Flashcards, and Content Library (HTML pages, PDF asset management). Supports rich content with HTML, base64 images, and KaTeX equations.
    - **Course Management**: Comprehensive course creation (STANDARD, PACKAGE types) with structured curriculum (Subject Section → Chapter → Lesson → LessonItem) and Admin curriculum builder.
    - **Video Module**: Full CRUD for Videos with status lifecycle and multi-provider support.
    - **Live Classes Module**: Full CRUD for live sessions with scheduling and platform support.
    - **User & System Management**: Full CRUD for Coupons, XP Rules, and Learners.
    - **User Management**: Full CRUD for users including role management, device blocking, and activity logs.
    - **XP Reward System**: Manages user wallets, source progress, achievements, and ledgers with various earning rules and a redemption system.
    - **Protected Content Gate**: Implements a consent system requiring user agreement to terms before accessing specific content types, with logging and watermarking.
    - **Rich Text Editor**: Custom `contentEditable`-based editor used for various content fields.
    - **E-Book Viewer**: Modal viewer for E-Book content with anti-copy protection, infringement logging, and learner annotation support.
    - **Flashcard Student Player**: Full-featured, one-card-at-a-time player supporting 8 card types.
    - **Infringement Monitoring**: Tracks copy/right-click/selection/keyboard-copy attempts on protected content with a 3-strike auto-block system and admin review.
    - **Learner Annotations**: Persists text highlights and underlines on E-Books and PDFs.
    - **Legal Acceptance Architecture**: Two-point enforcement (signup and checkout levels) using `legalAcceptedAt`/`legalVersion` with current version string managed in `lib/legalVersion.ts`.
    - **Refund Administration**: `Refund` model tracks details for processing and managing refunds, with admin UI.
    - **Revenue Reporting with Refunds**: Analytics dashboard KPIs now include refund-related metrics.
    - **Course Validity**: Supports Unlimited/Days/Months/Fixed End Date modes for course validity.
    - **Content Unlock Scheduling**: `unlockAt` field added to various content models and `LessonItem` for scheduled content release.
    - **Quiz Feature**: Standalone quiz product using the `Test` model with an `isQuiz` flag, separate admin UI, and API filtering.
    - **Taxonomy Extension — Board + Grade**: Taxonomy hierarchy extended to Board → Grade (Category) → Subject → Topic → Subtopic. `Board` is a new top-level model. The existing `Category` model is reused as "Grade" in learner-facing flows (displayed as Grade in taxonomy page and registration). `Category.boardId` (nullable for legacy data) links each grade to a board. `User.boardId` and `User.categoryId` (both nullable for legacy users) store the learner's board and grade at registration. The dedicated taxonomy page manages all five levels in one unified UI. The public `/api/public/boards` and `/api/public/grades?boardId=` endpoints serve the registration form. Student signup API at `/api/auth/student-signup` validates boardId + categoryId cross-membership on new registrations. Bulk imports continue to work by matching categories by name with boardId=null fallback. No separate Grade model or Grade admin page was created — everything is managed via the Taxonomy page. Zero TypeScript errors after migration.
    - **Multi-tenant (SchoolVerse) B2B Support**: `Tenant` model with nullable `User.tenantId` supports school/tenant linking. Admin user creation UI includes tenant selector.
    - **Student Registration Page**: Public registration form at `/register` with Board + Grade dropdowns, cascading from board selection, plus email/mobile + password + legal acceptance. Board and Grade are required for new students.
    - **Schema Drift Prevention**: Implements startup checks and health endpoint probes to detect and report schema-DB drift. Uses `prisma db push` for migrations.
    - **Student Test API & Pause/Resume**: New student-facing API for test attempts, including starting, resuming, answering, pausing, and submitting tests.
    - **TestHub Improvements**: (1) `strictSectionMode` already existed in schema/admin UI/student API — no change needed. (2) `AttemptSectionSubmit` model added to track per-section submissions (`@@unique([attemptId, sectionId])`); virtual back-relation on `Attempt`. `POST /api/student/attempts/[id]/section-submit` — validates `strictSectionMode=true`, idempotent upsert, returns `{ nextSection }` or `{ allSectionsSubmitted: true }`. (3) `validateSectionTimers()` helper blocks test save (POST + PUT) when section durations exceed total duration or are non-positive. (4) `resume` route now extends `endsAt` by pause duration — learner does not lose time during a pause.
    - **TestHub Safety Audit**: Full production safety audit applied. (1) `AttemptStatus.EXPIRED` added to schema (additive, safe); DB pushed and Prisma client regenerated. (2) `endsAt` is now set server-side at attempt creation (`endsAt = startedAt + durationSec × 1000`) — client timer can never extend server deadline. (3) Answer route enforces server-side timer: checks `now > endsAt`, lazily marks attempt `EXPIRED`, returns `TEST_EXPIRED (403)` — frontend should auto-submit on this code. (4) Answer route enforces section lock: rejects answers for sections already submitted via `AttemptSectionSubmit` with `SECTION_LOCKED (403)`. (5) Answer route validates all `selectedOptionIds` belong to the question — cross-question option injection is now blocked. (6) XP is now awarded on submit: attempt 1 → 100% of `test.xpValue`; attempt 2 → 50%; attempt ≥3 → 0%. Writes to `XpLedgerEntry`, `UserXpWallet` (upsert), and `UserXpSourceProgress`. XP failure is fire-and-forget — never breaks the submit response. (7) Pause route also checks `endsAt` before accepting a pause. (8) Submit route allows `EXPIRED` attempts to be submitted (so auto-submit on timer expiry works correctly). Zero TypeScript errors.
    - **Bilingual Question Support**: `Question` and `QuestionOption` models include `secondary` fields for a second language, supported in Question Bank forms and CSV imports.
    - **PDF Storage (Database-backed)**: PDF files are stored as binary data (`Bytes`) in the `PdfAsset.fileData` column in Neon PostgreSQL. No cloud storage sidecar needed — works on Vercel and Replit equally. Upload flow: POST multipart form to `/api/pdf-assets` → server stores binary in DB → sets `fileUrl` to `https://<host>/api/pdf-serve/<id>`. Serve endpoint at `GET /api/pdf-serve/[id]` streams the PDF from DB with correct `Content-Type: application/pdf` and `Access-Control-Allow-Origin: *` headers. All list/update API responses use explicit `select` (never `include`) to exclude `fileData` from JSON payloads. Max file size: 20MB.
    - **Zoom Integration (Live Classes)**: Server-to-Server OAuth integration via `lib/zoom.ts`. `LiveClass` schema extended with `zoomMeetingId`, `zoomPassword`, `zoomStartUrl` (additive). `POST /api/live-classes/zoom` with `action=create|update|delete` manages Zoom meetings from admin. Admin edit page shows a Zoom panel: "Create Zoom Meeting" auto-fills joinUrl + sessionCode; "Sync to Zoom" patches title/time; "Remove" deletes the meeting. Token is in-memory cached (55 min). Student API at `GET /api/student/live-classes` returns enriched `liveStatus` (upcoming|live_now|completed) and exposes joinUrl/password only within 15 minutes of session start.
    - **Video & Live Class Parity**: Both `Video` and `LiveClass` now share identical `unlockAt` scheduling support. `LiveClass.unlockAt` was added as an additive column. The curriculum route (`/api/courses/[id]/curriculum`) resolves unlock dates for all five content types: VIDEO, LIVE_CLASS, HTML_PAGE, PDF, FLASHCARD_DECK. The live-class edit form replaces the raw `replayVideoId` text input with a dropdown picker loaded from the published Video library. Quick Publish/Archive one-click buttons added to the Video edit page (parity with Live Classes).
    - **Shared Block Editor System**: Notion-like structured block editor used for EBook pages and Flashcard INFO cards. `lib/blocks/schema.ts` defines the `BlockDoc` type (versioned `{ v:1, blocks:Block[] }`) with 7 block types (paragraph, heading, image, box, table, list, divider). `lib/blocks/defaults.ts` provides factory helpers (`createBlock`, `htmlToBlocks`, `emptyDocWithParagraph`, `blocksToHtmlString`, `moveBlock`, `removeBlock`, `updateBlock`). `components/ui/BlockEditor.tsx` is the shared editor (controlled, props: `doc`, `onChange`, `config`, `disabled`, `label`). `components/ui/BlockRenderer.tsx` renders block docs to JSX. `EBookPage.contentBlocks Json?` field stores blocks (additive; legacy `contentHtml` still supported). Flashcard INFO cards store `bodyBlocks`/`exampleBlocks` in the content JSON field.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Hashing**: bcryptjs
- **Equation Rendering**: KaTeX