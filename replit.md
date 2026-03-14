# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. Key capabilities include authentication, managing taxonomy, question banks, test series, flashcards, content library, coupons, XP rules, learner data, video management, live class scheduling, analytics, reporting, refund administration, and legal acceptance enforcement. The project aims to provide a robust, scalable, and intuitive platform for educational content delivery and management.

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
- **Authentication**: Session-based with httpOnly cookie, protected by middleware, and featuring a 3-phase state machine for login with audit logging.
- **Validation**: Zod v4
- **Project Structure**: Organized into `app/` (pages, API routes), `components/` (UI, admin-specific), `lib/` (utilities, auth, Prisma client), `prisma/` (schema, seed, migrations), and `styles/`.
- **API Design**: RESTful API endpoints for all major entities.
- **Core Features**:
    - **Admin Authentication**: Secure login/logout, session management, and role-based access control (ADMIN, SUPER_ADMIN).
    - **Content Management**: Full CRUD for Taxonomy (tree view), Question Bank (with advanced features like bulk edit, imports), Test Series & Tests (section builder, question picker, publish flow), Flashcards (deck/card CRUD, reordering, image support, various card types with dynamic forms), and Content Library (HTML pages, PDF asset management). Supports rich content with HTML, base64 images, and KaTeX equations.
    - **Course Management**: Comprehensive course creation, including `STANDARD` and `PACKAGE` types. `PACKAGE` courses can import `STANDARD` courses. Features `thumbnailUrl` and product-type flags. Includes a structured curriculum system (Subject Section → Chapter → Lesson → LessonItem) with completion tracking and an Admin curriculum builder.
    - **Video Module**: Full CRUD for Videos with status lifecycle, multi-provider support (Bunny/YouTube/Manual), and course assignment.
    - **Live Classes Module**: Full CRUD for live sessions with scheduling, platform support (Zoom/YouTube Live), recording management, and faculty management.
    - **User & System Management**: Full CRUD for Coupons, XP Rules (with history), and Learners (profile panels, entitlements, status toggling). Analytics provides KPIs, charts, and reports.
    - **User Management**: Full CRUD for users, including role management, device blocking, session revocation, and detailed activity logs. Implements web device restriction with `maxWebDevices` limit.
    - **XP Reward System**: A complete XP engine managing user wallets, source progress, achievements, and ledgers. Includes rules for earning XP from content, daily logins, and streak bonuses, with a redemption system.
    - **Protected Content Gate**: Implements a consent system (`ContentConsent` model) requiring user agreement to terms before accessing specific content types, with logging and watermarking support.
    - **Rich Text Editor**: `components/ui/RichTextEditor.tsx` — contentEditable-based, no external deps. Toolbar: Bold/Italic/Underline/H1-H3/text color/highlight/note boxes/table/image/divider/preview. Used in E-Book editor and all flashcard content fields.
    - **E-Book Viewer**: `components/ui/EBookViewer.tsx` — modal viewer for E-Book (HTML_PAGE) content with anti-copy protection, infringement logging, and learner annotation support (highlight/underline with color picker, persisted via `/api/annotations`).
    - **Flashcard Student Player**: `components/ui/FlashcardPlayer.tsx` — full-featured one-card-at-a-time player supporting all 8 card types (Title, Info, Quiz, Comparison, Fill-in-Blank, Matching, Reorder, Categorization). Wired into lesson preview page for FLASHCARD_DECK items.
    - **Infringement Monitoring**: `InfringementEvent` model tracks copy/right-click/selection/keyboard-copy attempts on protected content. 3-strike auto-block system (WARNING_1 → WARNING_2 → AUTO_BLOCKED with session revocation). Admin review page at `/admin/users/infringement` with filters. Dashboard card with live stats.
    - **Learner Annotations**: `LearnerAnnotation` model persists text highlights and underlines on E-Books and PDFs. API at `/api/annotations` (CRUD). Annotations are reapplied via DOM Range API on each viewer open.
    - **Content Type Label**: "HTML Material"/"HTML Pages" renamed to "E-Book"/"E-Books" throughout the UI. Schema key remains `HTML_PAGE`.
    - **Product Category**: `ProductCategory` enum added to `Course` model (nullable, backward-compatible). 8 values: `FREE_DEMO`, `COMPLETE_PREP_PACK`, `VIDEO_ONLY`, `SELF_PREP`, `PDF_ONLY`, `TEST_SERIES`, `FLASHCARDS_ONLY`, `CURRENT_AFFAIRS`. Controls student-app placement. Shown as badge in course list; selectable dropdown in course create/edit form.
    - **Rich Editor — Cloze/Blank**: "Blank" toolbar button converts selected text into `<span data-blank="answer">_____</span>`. Answer stored in attribute; visual underline placeholder shown.
    - **Rich Editor — Keyword Tag**: "Tag" toolbar button with type picker (Keyword/Definition/Formula/Article/Date/Concept/Exception/Term + custom). Wraps selected text as a styled inline chip `<span data-tag="...">`.
    - **Rich Editor — Compare Block**: "Compare" toolbar button inserts a two-column side-by-side block with editable headers and bodies, placeholder CSS, and Backspace-to-delete-when-empty behavior.
    - **Legal Acceptance Architecture**: Two-point legal acceptance enforcement — (A) signup-level: `legalAcceptedAt`/`legalVersion` stored on `User` model; backend rejects signup if `legalAccepted` not true. (B) checkout-level: `legalAcceptedAt`/`legalVersion` stored on `Purchase` model; `simulate-purchase` API rejects if `legalAccepted` not true. Current version string managed in `lib/legalVersion.ts` (`CURRENT_LEGAL_VERSION = "v1.0"`). Student signup API at `POST /api/auth/student-signup`.
    - **Refund Administration**: `Refund` model tracks purchaseId, userId, amountPaidPaise, reason, consumptionPct, adminRemarks, approvedPaise, refundPct, status (PENDING/APPROVED/PARTIALLY_APPROVED/REJECTED/REFUNDED), processedById, processedAt. Admin CRUD at `/api/refunds` (GET/POST) and `/api/refunds/[id]` (GET/PUT). Admin UI at `/admin/refunds`. Policy: within 3 days of purchase, ≤10% content consumed; final decision at institution's discretion.
    - **Revenue Reporting with Refunds**: Analytics dashboard KPIs now include `refundedPaise`, `refundCount`, `pendingRefunds`, and `adjustedNetRevenuePaise` (net minus approved refunds). Learner purchase history includes refund status.
    - **Course Validity**: `validityType`/`validityDays`/`validityMonths`/`validUntil` fields on Course. UI supports Unlimited/Days/Months/Fixed End Date modes.
    - **Test Scheduled Start Time**: `testStartTime DateTime?` field on Test. Editable via datetime-local input in test builder.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Hashing**: bcryptjs
- **Equation Rendering**: KaTeX