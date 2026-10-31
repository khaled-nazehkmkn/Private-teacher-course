# Teacher Private-Lessons App — Business Spec & Build Guide

Arabic-only (RTL) web app for Egyptian private-lesson teachers. Stack: **Next.js + Supabase + Vercel**, free tiers.

---

## 1. Product summary

- Generic for any subject (math, English, Arabic...). **One teacher = one subject.**
- The teacher manages groups (class + weekly days/times), students, attendance, make-ups, quizzes/exams and reports.
- **No student accounts.** Students take exams through a link + personal code.
- Parent communication is by **WhatsApp click-to-chat links** (`https://wa.me/<number>?text=<encoded Arabic text>`). The app prepares the message, the teacher taps send. No paid WhatsApp API in v1.
- Multi-teacher: the owner (admin) creates teacher accounts and sets their active period.

## 2. Roles

| Role | Can do |
|---|---|
| **Admin (owner)** | Create/suspend teachers, set `active_from` / `active_to`, see list of teachers |
| **Teacher** | Everything inside their own data only |
| **Student (no login)** | Open exam link, enter access code, solve, submit; see result only after teacher releases it |

Login: **email + password** (Supabase Auth). Teachers cannot self-register; the admin creates them.

When a teacher's `active_to` passes or they are suspended: **read-only mode** (can view, cannot add/edit; exams close).

## 3. Business rules

### 3.1 Groups and students
- A group = name + grade + capacity + one or more weekly sessions (weekday, start, end). Example: Sat 17:00 and Tue 17:00.
- A student belongs to **exactly one group** per teacher. Student has: name, parent phone, grade, auto-generated 4–6 digit **access code** (unique per teacher).
- **Moving a student** (permanent) is allowed only if: same grade, target group has free capacity, and no conflict. History is kept.
- The same real student may exist under different teachers as separate records.

### 3.2 Sessions and attendance
- Session occurrences (real dates) are generated from the group's weekly sessions.
- A teacher can mark an occurrence **cancelled** (holiday/illness); it never counts against students.
- Attendance statuses: `present`, `late`, `absent`, `excused`.

### 3.3 Absence counter
- Computed, not stored. Per student, per period (default: current month; teacher can change).
- Counts `absent` only, **excluding absences that were made up**.
- Color scale: **green 0–1, yellow 2–3, orange 4, red 5+** (thresholds configurable per teacher).
- Alert triggers: **2 consecutive** absences or **3 total** in the period.
- Each student row has a **"send to parent"** button → opens WhatsApp with a prepared Arabic message listing absence dates and days. The teacher decides whether to send. Every prepared message is logged in `message_log`.

### 3.4 Make-up sessions
- A student who was absent can **request** (via the parent/teacher) to attend another group's session at a different time.
- Rule: the target group must be the **same grade** (and same teacher). Target must have capacity for that occurrence.
- Flow: teacher creates/approves a `makeup_request` → student attends target occurrence (attendance row with `makeup_of` = missed occurrence) → the original absence stops counting.
- If rejected, the absence stays.

### 3.5 Questions and exams
**v1: choice questions only** (auto-marked). Planned order after that: true/false → short answer → matching → essay (manual marking) → image answers.

- Question: text (+ optional image, optional LaTeX), 2–6 options, one correct (v1), marks, topic, grade, difficulty.
- **Question bank** per teacher; questions can be reused across exams.
- **Import**: JSON paste/upload, Excel/CSV template, or manual form. Preview before saving; option "save to my bank".
- **Exam**: title, group (or grade), duration, open/close window, shuffle questions/options, picked or random questions from bank (e.g. 10 random from Unit 3).
- **Taking an exam** (no login):
  1. Student opens exam link (or QR).
  2. Enters their access code.
  3. Server checks: code valid, exam within window, **one attempt only** (unique constraint).
  4. Timer runs; answers autosave; on submit the **server marks** the answers.
  5. Student does **not** see the score until the teacher sets `results_released = true`.
- Correct answers are **never sent to the browser** before submission.
- Teacher sees: per-student marks, class average, per-question analysis (most-missed questions), and a button to send each parent the result via WhatsApp link.
- Honest limitation: not a proctored exam (students use own phones). Shuffling + timer reduce copying.

### 3.6 Dashboard and reports
- Dashboard: today's sessions, students with absence alerts, pending make-up requests, recent exams.
- Class report, student report (attendance + exam history), printable/PDF.

## 4. Question import format (JSON)

```json
{
  "questions": [
    {
      "type": "mcq",
      "text": "ما قيمة x إذا كانت 2x + 4 = 10؟",
      "options": ["2", "3", "4", "5"],
      "correct": [1],
      "marks": 2,
      "topic": "المعادلات",
      "grade": "الصف الثاني الإعدادي",
      "difficulty": "easy",
      "image": "triangle1.png"
    }
  ]
}
```

- `correct` = zero-based index/indices into `options`.
- `image` matches the file name of an image uploaded together with the JSON.
- Images are compressed on upload (free Storage is ~1 GB).
- Arabic-Indic digits (٣) and Western digits (3) should be treated as equal when answers are compared (needed later for short answers).

## 5. Database (Supabase / Postgres)

Run as a migration (`supabase/migrations/0001_init.sql`).

```sql
-- Extensions
create extension if not exists "pgcrypto";

-- Teachers (id = auth.users.id)
create table teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  subject text,
  is_admin boolean not null default false,
  active_from date,
  active_to date,
  is_suspended boolean not null default false,
  absence_consecutive_limit int not null default 2,
  absence_total_limit int not null default 3,
  created_at timestamptz not null default now()
);

create or replace function is_teacher_active(t uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from teachers
    where id = t
      and not is_suspended
      and (active_from is null or active_from <= current_date)
      and (active_to is null or active_to >= current_date)
  );
$$;

create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select coalesce((select is_admin from teachers where id = auth.uid()), false);
$$;

-- Groups
create table groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  name text not null,
  grade text not null,
  capacity int not null default 20,
  created_at timestamptz not null default now()
);

create table group_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null
);

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  full_name text not null,
  parent_phone text not null,
  grade text not null,
  access_code text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, access_code)
);

-- Sessions and attendance
create table session_occurrences (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'held' check (status in ('held','cancelled')),
  unique (group_id, session_date, start_time)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  occurrence_id uuid not null references session_occurrences(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('present','late','absent','excused')),
  makeup_of uuid references session_occurrences(id), -- the missed occurrence this one makes up
  note text,
  unique (occurrence_id, student_id)
);

create table makeup_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  missed_occurrence_id uuid not null references session_occurrences(id),
  target_occurrence_id uuid not null references session_occurrences(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Question bank and exams
create table questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  type text not null default 'mcq' check (type in ('mcq','true_false','short','matching','essay')),
  body text not null,
  image_path text,
  options jsonb,
  correct jsonb,
  marks numeric not null default 1,
  topic text,
  grade text,
  difficulty text,
  created_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  grade text,
  title text not null,
  duration_min int not null default 30,
  opens_at timestamptz,
  closes_at timestamptz,
  shuffle boolean not null default true,
  results_released boolean not null default false,
  public_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create table exam_questions (
  exam_id uuid not null references exams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  position int not null default 0,
  marks_override numeric,
  primary key (exam_id, question_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  unique (exam_id, student_id)           -- one attempt only
);

create table answers (
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id),
  answer jsonb,
  is_correct boolean,
  marks_awarded numeric,
  primary key (submission_id, question_id)
);

create table message_log (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  kind text not null check (kind in ('absence','result','custom')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index on students (teacher_id, group_id);
create index on attendance (student_id, status);
create index on session_occurrences (group_id, session_date);
create index on submissions (exam_id);

-- Absence view: counts absences that were NOT made up
create view student_absences as
select a.teacher_id, a.student_id, o.session_date, o.id as occurrence_id
from attendance a
join session_occurrences o on o.id = a.occurrence_id
where a.status = 'absent'
  and not exists (
    select 1 from attendance m
    where m.student_id = a.student_id
      and m.makeup_of = a.occurrence_id
      and m.status in ('present','late')
  );
```

### Row Level Security

```sql
-- Enable RLS on every table
alter table teachers enable row level security;
alter table groups enable row level security;
alter table group_sessions enable row level security;
alter table students enable row level security;
alter table session_occurrences enable row level security;
alter table attendance enable row level security;
alter table makeup_requests enable row level security;
alter table questions enable row level security;
alter table exams enable row level security;
alter table exam_questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table message_log enable row level security;

-- teachers: read own row (admin reads all); only service role writes
create policy teachers_read on teachers for select
  using (id = auth.uid() or is_admin());

-- Pattern for tables with teacher_id: read own; write only when active
-- Repeat for: groups, students, session_occurrences, attendance,
-- makeup_requests, questions, exams, submissions, message_log
create policy groups_read  on groups for select using (teacher_id = auth.uid());
create policy groups_write on groups for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Child tables without teacher_id: check through the parent
create policy gs_read on group_sessions for select using (
  exists (select 1 from groups g where g.id = group_id and g.teacher_id = auth.uid()));
create policy gs_write on group_sessions for all using (
  exists (select 1 from groups g where g.id = group_id and g.teacher_id = auth.uid())
  and is_teacher_active(auth.uid()));

create policy eq_read on exam_questions for select using (
  exists (select 1 from exams e where e.id = exam_id and e.teacher_id = auth.uid()));
create policy eq_write on exam_questions for all using (
  exists (select 1 from exams e where e.id = exam_id and e.teacher_id = auth.uid())
  and is_teacher_active(auth.uid()));

create policy ans_read on answers for select using (
  exists (select 1 from submissions s where s.id = submission_id and s.teacher_id = auth.uid()));
```

> The AI agent must generate the `_read` / `_write` policy pair for **every** table that has `teacher_id`, following the `groups` pattern above. The student exam flow does **not** use RLS: it goes through server routes with the service-role key (see section 7).

## 6. Connecting Supabase with Vercel (step by step)

### 6.1 Create the Supabase project
1. Sign in at supabase.com → **New project**. Pick the region closest to Egypt (e.g. **Frankfurt**), set a strong database password, save it.
2. **SQL Editor** → run the migration from section 5 (or use the Supabase CLI: `supabase init`, `supabase link`, `supabase db push`).
3. **Storage** → create a bucket `question-images` (public read, or private with signed URLs).
4. **Authentication → Providers**: keep Email enabled. Turn **off** public sign-ups (Auth settings → "Allow new users to sign up" off), since the admin creates teachers.
5. Create your own admin: add a user in **Authentication → Users**, then insert a `teachers` row for that user id with `is_admin = true`.

### 6.2 Get the keys
**Project Settings → API** (or "API Keys"):
- **Project URL**
- **anon / publishable key** (safe for the browser, protected by RLS)
- **service_role / secret key** (server only, bypasses RLS, **never** expose it or prefix it with `NEXT_PUBLIC_`)

### 6.3 Next.js project
```bash
npx create-next-app@latest teacher-app --typescript --tailwind --app
cd teacher-app
npm i @supabase/supabase-js @supabase/ssr
```
`.env.local` (never commit):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
Create three helpers:
- `lib/supabase/browser.ts` — `createBrowserClient` (anon key)
- `lib/supabase/server.ts` — `createServerClient` with cookies (anon key; acts as the logged-in teacher)
- `lib/supabase/admin.ts` — `createClient(url, SERVICE_ROLE_KEY)`; **server-only** (admin panel and student exam routes)

Add middleware that refreshes the session and redirects unauthenticated users to `/login`.

Root layout for Arabic: `<html lang="ar" dir="rtl">` and a font such as Cairo or Tajawal (`next/font/google`).

### 6.4 Deploy on Vercel
1. Push the repo to GitHub.
2. vercel.com → **Add New → Project** → import the repo (framework is detected as Next.js).
3. **Settings → Environment Variables**: add the same three variables for Production, Preview and Development. Mark the service-role key as sensitive.
4. Deploy. Then in Supabase **Authentication → URL Configuration**: set **Site URL** to your Vercel URL (later your custom domain) and add `https://your-app.vercel.app/**` to **Redirect URLs**.
5. Optional shortcut: the **Supabase integration** from the Vercel Marketplace can create/link a project and sync the environment variables automatically.
6. Redeploy after changing environment variables (they only apply to new deployments).

### 6.5 Free-tier cautions
- **Supabase free pauses the project after ~1 week of inactivity.** Add a small health route (e.g. `/api/ping` doing a trivial query) and call it with a **Vercel Cron** (`vercel.json`, once a day) to keep it active; otherwise unpause manually.
- **Vercel Hobby is for non-commercial use.** Once you charge teachers, move to a paid plan.
- Supabase free limits: ~500 MB database, ~1 GB storage, limited bandwidth. Compress images; delete old exam files if needed.
- Backups on the free plan are limited: export important data periodically.

## 7. Server routes (important logic)

| Route | Purpose | Client used |
|---|---|---|
| `POST /api/admin/teachers` | Create auth user + `teachers` row, set active dates | service role, admin only |
| `PATCH /api/admin/teachers/[id]` | Change dates / suspend | service role, admin only |
| `GET /api/exam/[token]` | Exam metadata (title, duration, is open?) — no questions | service role |
| `POST /api/exam/[token]/start` | Body: access code. Validates student, window, no previous submission; creates submission; returns questions **without correct answers**, shuffled | service role |
| `POST /api/exam/[token]/answer` | Autosave a single answer | service role |
| `POST /api/exam/[token]/submit` | Marks on the server, stores score | service role |
| `GET /api/exam/[token]/result` | Returns score only if `results_released` | service role |

Rate-limit the code attempts (e.g. 5 wrong codes per IP per 10 minutes) so codes can't be brute-forced.

## 8. Screens (all Arabic)

Login · Admin: teachers list/create/suspend · Dashboard · Groups (list, create, sessions) · Group details (students, attendance, schedule) · Students (list, add, import Excel, move) · Attendance (quick tap list per session) · Absence counter (colored, send button) · Make-up requests · Question bank · Import questions (JSON/Excel, preview) · Exam builder · Exam results (per student, per question, release switch, send to parent) · Student report · Class report · Message log · Public exam page (code entry, exam, thank-you/result).

## 9. Task plan for the AI agent

Give each task its own prompt: goal, files to touch, acceptance checks, "do not touch" list. Use **Arabic text for all UI strings**, RTL layout, mobile-first.

**Phase 0 — Setup**
1. Scaffold Next.js (App Router, TypeScript, Tailwind), RTL, Cairo font, base layout and UI components (button, input, table, modal, toast).
2. Supabase clients (browser/server/admin), env handling, auth middleware.
3. Migration SQL + RLS policies (section 5). Seed an admin user.

**Phase 1 — Accounts**
4. Login/logout page, session handling.
5. Admin panel: list/create/suspend teachers, active dates; read-only mode when expired (shared `useTeacherStatus`).

**Phase 2 — Groups and students**
6. Groups CRUD with weekly sessions.
7. Students CRUD, access-code generator, Excel import with validation.
8. Move student between groups (same grade, capacity check).

**Phase 3 — Attendance**
9. Generate session occurrences (rolling 8 weeks) from weekly sessions; cancel an occurrence.
10. Attendance screen (default present, tap to change status, save in one request).
11. Absence counter page: view `student_absences`, period filter, colored badges, configurable thresholds.
12. WhatsApp message builder (Arabic template with absence dates/days) + `message_log`.
13. Make-up requests: create, approve/reject, attendance with `makeup_of`, counter excludes made-up absences.

**Phase 4 — Exams (v1 choice only)**
14. Question bank CRUD with image upload (client-side compression to Supabase Storage).
15. Import: JSON + Excel template with preview and "save to bank".
16. Exam builder: pick/random from bank, window, duration, shuffle, share link + QR.
17. Student exam flow (section 7 routes), timer, autosave, server marking, one attempt.
18. Teacher results: per student, per question analysis, release switch, parent WhatsApp result message.

**Phase 5 — Dashboard and reports**
19. Dashboard widgets (today's sessions, alerts, pending make-ups, recent exams).
20. Class and student reports, print/PDF.
21. Vercel Cron keep-alive route, error pages, loading states, final QA pass.

**Later**
True/false, short answer (with Arabic-digit normalization), matching, essay with manual marking, image answers, LaTeX (KaTeX), custom domain and branding per teacher, optional paid WhatsApp API.

## 10. Acceptance checklist (v1)

- [ ] A teacher can never see another teacher's data (test with two accounts).
- [ ] Expired/suspended teacher is read-only; exams are closed.
- [ ] Student cannot take an exam twice, outside the window, or with a wrong code.
- [ ] Correct answers never appear in any network response before submission.
- [ ] Made-up absences stop counting; cancelled sessions never count.
- [ ] Absence colors match the thresholds (green 0–1, yellow 2–3, orange 4, red 5+).
- [ ] All screens are Arabic, RTL, and usable on a phone.
- [ ] App deployed on Vercel, connected to Supabase, keep-alive cron active.
