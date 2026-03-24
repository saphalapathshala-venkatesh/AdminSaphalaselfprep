# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. The project aims to provide a robust, scalable, and intuitive platform for educational content delivery and management.

## User Preferences
I prefer clear and direct communication. When making changes, please explain the "why" behind them, not just the "what." I prefer an iterative development approach, where features are built and reviewed in small, manageable increments. Before implementing any major architectural changes or introducing new dependencies, please ask for confirmation. Do not make changes to files outside the `app/`, `components/`, `lib/`, `prisma/`, `public/`, `styles/` directories.

## System Architecture

### UI/UX Decisions
The console uses a consistent brand palette with purple as the primary CTA color and semantic colors for specific elements. It features a styled "S" monogram logo and utilizes reusable UI components like tables, modals, and inputs. The dashboard incorporates instant skeleton loaders and animated shimmer placeholders for improved perceived performance.

### Technical Implementations
- **Framework**: Next.js 14 (App Router) with TypeScript.
- **Database**: PostgreSQL with Prisma ORM v5.
- **Authentication**: Session-based with httpOnly cookie, middleware protection, and a 3-phase login state machine with audit logging.
- **Validation**: Zod v4.
- **Project Structure**: Organized into `app/`, `components/`, `lib/`, `prisma/`, `public/`, and `styles/` directories.
- **API Design**: RESTful API endpoints for all major entities.
- **Core Features**:
    - **Admin & User Management**: Secure login/logout, session management, role-based access control, full CRUD for users, roles, devices, and activity logs.
    - **Content Management**: Full CRUD for Taxonomy (Board, Grade, Subject, Topic, Subtopic), Question Bank, Test Series & Tests, Flashcards, and Content Library (HTML pages, PDF asset management). Supports rich content, KaTeX equations, and bilingual questions. Includes content unlock scheduling.
    - **Course Management**: Comprehensive course creation (STANDARD, PACKAGE types) with structured curriculum and an Admin curriculum builder. Supports various course validity types.
    - **Media Modules**: Full CRUD for Videos (multi-provider support, status lifecycle) and Live Classes (scheduling, platform support, Zoom integration).
    - **XP Reward System**: Manages user wallets, source progress, achievements, and ledgers with earning rules and redemption.
    - **Protected Content Gate**: Consent system with logging and watermarking.
    - **Rich Text Editor**: Custom `contentEditable`-based editor for various content fields.
    - **E-Book Viewer**: Modal viewer with anti-copy protection, infringement logging, and learner annotations.
    - **Flashcard Student Player**: Full-featured player supporting 8 card types.
    - **Infringement Monitoring**: Tracks content copy attempts with a 3-strike auto-block system.
    - **Legal Acceptance Architecture**: Two-point enforcement for legal terms acceptance.
    - **Refund System**: Both admin-created (legacy) and student-initiated refund request workflows with status tracking and admin UI. Integrated into revenue reporting.
    - **Quiz Feature**: Standalone quiz product using the `Test` model.
    - **Multi-tenant Support**: `Tenant` model for B2B school/tenant linking.
    - **Student Registration**: Public registration form with required Board and Grade selection.
    - **Schema Drift Prevention**: Startup checks and health endpoint probes for database schema consistency.
    - **Student Test API**: API for starting, resuming, answering, pausing, and submitting tests with server-side timer enforcement, section locking, and anti-cheat measures. XP awarded on submit.
    - **Shared Block Editor System**: Notion-like structured block editor (`BlockDoc` with 7 block types) for EBook pages and Flashcard INFO cards.
    - **Cashfree Payment Infrastructure**: Full payment integration with Cashfree PG V3, including order creation, verification, and webhook processing. Idempotent settlement helper prevents duplicate purchases.
    - **Dual-Layer Coupon Applicability System**: Coupons now support a two-layer AND-gate applicability model. Layer 1 (Product Category) uses the existing `ProductCategory` enum (8 values: 7 paid + FREE_DEMO). Layer 2 (Exam Category) uses the `Category` taxonomy table fetched dynamically from DB. New fields on `Coupon`: `appliesToAllPaidProductCategories Boolean @default(true)`, `appliesToAllExamCategories Boolean @default(true)`. New junction tables: `CouponProductCategoryScope` (stores enum value, not FK) and `CouponExamCategoryScope` (FK to Category). `ProductPackage` gains `productCategory ProductCategory?` (enum) and `categoryId String?` (FK to Category exam taxonomy) — both optional, used for coupon targeting. Coupon evaluation in orders route checks BOTH conditions after legacy entitlement check. Admin `GET /api/admin/product-categories` serves product category metadata to UI. FREE_DEMO is excluded from coupon product category scopes at API level. Old coupons default to `appliesToAll*=true` — fully backward compatible.
    - **Shared-Subject Taxonomy Architecture**: Additive `CategorySubject` junction table allows one `Subject` to appear under multiple `Category` entries. `Subject.categoryId` remains the primary/owner category (unchanged). `CategorySubject(id, categoryId, subjectId, @@unique[categoryId,subjectId])` stores secondary mappings only. `Subject.subjectColor String?` added — all new subjects auto-assigned a color from a 12-color controlled palette if not manually chosen. Taxonomy API `GET ?level=subject&parentId=categoryId` now unions direct + shared subjects (de-duplicated) and returns metadata: `isSharedForSelectedCategory`, `ownerCategoryId`, `ownerCategoryName`. `GET ?level=subject&id=X` returns subject detail with secondary category mappings. Admin taxonomy page extended with color picker (controlled palette swatches + hex input) and multi-select secondary categories on Subject create/edit. Tree view shows shared subjects with a "Shared · <owner>" badge and uses subject color for the indicator dot. All product forms (ebooks, PDFs, tests, question bank, videos, flashcards, live classes) automatically inherit shared subjects via the central API change — no per-form changes required. Helper lib `lib/taxonomy.ts` exports: `getSubjectsForCategory()`, `syncCategorySubjectMappings()`, `assignSubjectColor()`. Helper `lib/subjectColors.ts` exports `CONTROLLED_PALETTE`, `getSafeSubjectColor()`, `assignSubjectColor()`. All existing subject colors and records fully preserved — purely additive change.
    - **Course Pricing Ownership**: Course is the sole commercial/sellable entity and the only pricing source of truth. Test Series is an academic content entity with no pricing inputs in the UI. `Course` model has `mrp Decimal? @db.Decimal(10,2)`, `sellingPrice Decimal? @db.Decimal(10,2)`, `isFree Boolean @default(false)` as the canonical pricing fields — stored in rupees with paise precision. Legacy `mrpPaise Int?` / `sellingPricePaise Int?` remain in schema for backward compat but are deprecated. `lib/pricing.ts` exports: `formatRupee()` (strip .00, show decimals only when needed, always prefix ₹), `calculateDiscount(mrp, sellingPrice)`, `validatePricing(isFree, mrp, sellingPrice)`, `parseRupees()`, `getCoursePriceDisplay()`. Admin Course form has a live Pricing section with free toggle, MRP/selling price inputs, and real-time discount badge. Test Series admin page has no pricing fields — only academic metadata. Course API POST/PUT/GET serialize Decimal to `number` and compute `discountPercent` in responses. DB rule: NEVER `migrate dev`; NEVER `--accept-data-loss`; additive schema ops only.

## External Dependencies
- **Database**: PostgreSQL (managed via Neon)
- **ORM**: Prisma ORM v5
- **Framework**: Next.js 14
- **Language Tooling**: TypeScript
- **Validation Library**: Zod v4
- **Hashing**: bcryptjs
- **Equation Rendering**: KaTeX
- **Video Conferencing**: Zoom
- **Payment Gateway**: Cashfree PG V3