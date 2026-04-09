# Saphala Self Prep Admin Console

## Overview
The Saphala Self Prep Admin Console is an admin-only platform for managing the Saphala Self Prep educational ecosystem. It provides comprehensive tools for content management, user administration, and system configuration. Its primary purpose is to empower administrators with a robust interface to oversee and maintain the self-prep platform, ensuring smooth operation and effective delivery of educational content. The project aims to provide a robust, scalable, and intuitive platform for educational content delivery and management, including business vision, market potential, and project ambitions to revolutionize educational content delivery.

## User Preferences
I prefer clear and direct communication. When making changes, please explain the "why" behind them, not just the "what." I prefer an iterative development approach, where features are built and reviewed in small, manageable increments. Before implementing any major architectural changes or introducing new dependencies, please ask for confirmation. Do not make changes to files outside the `app/`, `components/`, `lib/`, `prisma/`, `public/`, and `styles/` directories.

## System Architecture

### UI/UX Decisions
The console uses a consistent brand palette with purple as the primary CTA color and semantic colors. It features a styled "S" monogram logo and utilizes reusable UI components like tables, modals, and inputs. The dashboard incorporates instant skeleton loaders and animated shimmer placeholders.

### Technical Implementations
- **Framework**: Next.js 14 (App Router) with TypeScript.
- **Database**: PostgreSQL with Prisma ORM v5.
- **Authentication**: Session-based with httpOnly cookie, middleware protection, and a 3-phase login state machine with audit logging.
- **Validation**: Zod v4.
- **Project Structure**: Organized into `app/`, `components/`, `lib/`, `prisma/`, `public/`, and `styles/` directories.
- **API Design**: RESTful API endpoints for all major entities.
- **Core Features**:
    - **Admin & User Management**: Secure login/logout, session management, role-based access control, full CRUD for users, roles, devices, and activity logs.
    - **Content Management**: Full CRUD for Taxonomy (Board, Grade, Subject, Topic, Subtopic), Question Bank, Test Series & Tests, Flashcards, and Content Library (HTML pages, PDF asset management). Supports rich content, KaTeX equations, bilingual questions, and content unlock scheduling.
    - **Course Management**: Comprehensive course creation (STANDARD, PACKAGE types) with structured curriculum and an Admin curriculum builder. Supports various course validity types.
    - **Media Modules**: Full CRUD for Videos (multi-provider support, status lifecycle) and Live Classes (scheduling, platform support, Zoom integration) with many-to-many course linking.
    - **XP Reward System**: Manages user wallets, source progress, achievements, and ledgers with earning rules and redemption.
    - **Protected Content Gate**: Consent system with logging and watermarking.
    - **Rich Text Editor**: Custom `contentEditable`-based editor.
    - **E-Book Viewer**: Modal viewer with anti-copy protection, infringement logging, and learner annotations.
    - **Flashcard Student Player**: Full-featured player supporting 8 card types.
    - **Infringement Monitoring**: Tracks content copy attempts with a 3-strike auto-block system.
    - **Legal Acceptance Architecture**: Two-point enforcement for legal terms acceptance.
    - **Refund System**: Admin-created and student-initiated refund request workflows with status tracking and admin UI.
    - **Quiz Feature**: Standalone quiz product using the `Test` model.
    - **Multi-tenant Support**: `Tenant` model for B2B school/tenant linking.
    - **Student Registration**: Public registration form with required Board and Grade selection.
    - **Schema Drift Prevention**: Startup checks and health endpoint probes for database schema consistency.
    - **Student Test API**: API for starting, resuming, answering, pausing, and submitting tests with server-side timer enforcement, section locking, and anti-cheat measures.
    - **Shared Block Editor System**: Notion-like structured block editor for EBook pages and Flashcard INFO cards, supporting image uploads from Base64 to CDN.
    - **Cashfree Payment Infrastructure**: Full payment integration with Cashfree PG V3, including order creation, verification, and webhook processing with idempotency.
    - **Dual-Layer Coupon Applicability System**: Supports two-layer AND-gate applicability based on product and exam categories, with backward compatibility.
    - **Shared-Subject Taxonomy Architecture**: Allows one `Subject` to appear under multiple `Category` entries, with subject color assignment and enhanced admin UI for management.
    - **Video Multi-Course Linking**: Allows one video to be linked to multiple courses simultaneously via a junction table.
    - **Video XP Rewards**: Enables XP rewards for video completion, tracked atomically to prevent duplicates, with frontend integration for students.
    - **Question Group / Paragraph Questions**: Supports grouping questions under shared passages/paragraphs, with rich editing, LaTeX conversion from DOCX, and image hosting.
    - **Doubts Module**: Comprehensive module for managing student doubts, including status tracking, student context, and admin reply functionality.
    - **CourseLinkedContent System**: Allows linking existing standalone content (Test Series, PDF, E-Book, Video, Flashcard Deck, Live Class) to a course by reference.
    - **Course Pricing Ownership**: Course is the sole commercial/sellable entity, housing canonical pricing fields (`mrp`, `sellingPrice`, `isFree`) with utilities for formatting and validation.

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