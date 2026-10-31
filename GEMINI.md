# Workspace Coding Guidelines & Architecture Patterns

This workspace implements an Arabic-first (RTL) private-lesson management application for Egyptian teachers using Next.js (App Router), Supabase (Auth, PostgreSQL, Storage, RLS), and Tailwind CSS.

## 1. Architecture & Design Principles
- **Strict Role-Based Separation**:
  - `Admin`: Controls teacher lifecycle, provisioning, suspension, and valid date bounds (`active_from` to `active_to`).
  - `Teacher`: Operates purely within their tenant boundary (`teacher_id = auth.uid()`). Suspended/expired teachers enter a read-only state.
  - `Student`: No authentication account. Accesses exams exclusively via public unique tokens + 4–6 digit access codes handled securely by server-side endpoints with the service role key.
- **Security & Integrity**:
  - External and database calls must be wrapped in `try-catch` blocks with error logging.
  - Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side bundles.
  - Never send correct answers or marking criteria to the student client prior to submission.
  - Rate-limit student exam access code attempts.
- **RTL & Arabic UX**:
  - Root layout: `<html lang="ar" dir="rtl">` with the `Cairo` font.
  - All UI strings, notifications, confirmations, and WhatsApp templates are in Egyptian Arabic.
  - Mobile-first responsiveness is mandatory.

## 2. Naming Conventions & Code Style
- **File Structure**:
  - `app/`: Next.js App Router routes, API endpoints, layouts, and pages.
  - `components/`: Modular React components. Shared UI in `components/ui/`.
  - `lib/supabase/`: Client wrappers (`browser.ts`, `server.ts`, `admin.ts`).
  - `lib/`: Business logic, formatting, WhatsApp link generator, date/time helpers.
  - `supabase/migrations/`: PostgreSQL DDL migrations and RLS policies.
- **Naming**:
  - PascalCase for React components (`AttendanceSheet.tsx`, `ExamBuilder.tsx`).
  - camelCase for utility functions and hooks (`useTeacherStatus.ts`, `generateWhatsAppLink.ts`).
  - snake_case for PostgreSQL database tables and columns (`session_occurrences`, `makeup_requests`).
- **Styling**:
  - Tailwind CSS 4 utility classes matching the primary palette (`#153b68`, `#1d5ca8`, `#f6f8fb`).
  - Color-coded badges for absence thresholds: green (0–1), yellow (2–3), orange (4), red (5+).

## 3. Database & RLS Protocols
- Every table containing `teacher_id` must enforce RLS with both `_read` (own data) and `_write` (own data + `is_teacher_active()`) policies.
- Child tables inherit security checks through their parent records.
