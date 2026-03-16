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
    - **Schema Drift Prevention**: Implements startup checks and health endpoint probes to detect and report schema-DB drift. Uses `prisma db push` for migrations.
    - **Student Test API & Pause/Resume**: New student-facing API for test attempts, including starting, resuming, answering, pausing, and submitting tests.
    - **TestHub Improvements**: (1) `strictSectionMode` already existed in schema/admin UI/student API — no change needed. (2) `AttemptSectionSubmit` model added to track per-section submissions (`@@unique([attemptId, sectionId])`); virtual back-relation on `Attempt`. `POST /api/student/attempts/[id]/section-submit` — validates `strictSectionMode=true`, idempotent upsert, returns `{ nextSection }` or `{ allSectionsSubmitted: true }`. (3) `validateSectionTimers()` helper blocks test save (POST + PUT) when section durations exceed total duration or are non-positive. (4) `resume` route now extends `endsAt` by pause duration — learner does not lose time during a pause.
    - **Bilingual Question Support**: `Question` and `QuestionOption` models include `secondary` fields for a second language, supported in Question Bank forms and CSV imports.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Hashing**: bcryptjs
- **Equation Rendering**: KaTeX