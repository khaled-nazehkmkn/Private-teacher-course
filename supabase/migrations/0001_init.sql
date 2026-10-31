-- ==============================================================================
-- Teacher Private-Lessons App Migration (0001_init.sql)
-- Complete PostgreSQL schema + RLS policies
-- ==============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- Teachers (id matches auth.users.id)
create table if not exists teachers (
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

-- Active check function
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

-- Admin check function
create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select coalesce((select is_admin from teachers where id = auth.uid()), false);
$$;

-- Groups
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  name text not null,
  grade text not null,
  capacity int not null default 20,
  created_at timestamptz not null default now()
);

-- Group recurring sessions (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
create table if not exists group_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);

-- Students
create table if not exists students (
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

-- Sessions occurrences (actual dates)
create table if not exists session_occurrences (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'held' check (status in ('held','cancelled')),
  unique (group_id, session_date, start_time)
);

-- Attendance
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  occurrence_id uuid not null references session_occurrences(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('present','late','absent','excused')),
  makeup_of uuid references session_occurrences(id),
  note text,
  unique (occurrence_id, student_id)
);

-- Make-up requests
create table if not exists makeup_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  missed_occurrence_id uuid not null references session_occurrences(id),
  target_occurrence_id uuid not null references session_occurrences(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Question bank
create table if not exists questions (
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

-- Exams
create table if not exists exams (
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

-- Exam question mapping
create table if not exists exam_questions (
  exam_id uuid not null references exams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  position int not null default 0,
  marks_override numeric,
  primary key (exam_id, question_id)
);

-- Submissions
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  unique (exam_id, student_id)
);

-- Student answers
create table if not exists answers (
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id),
  answer jsonb,
  is_correct boolean,
  marks_awarded numeric,
  primary key (submission_id, question_id)
);

-- Message log
create table if not exists message_log (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  kind text not null check (kind in ('absence','result','custom')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_students_teacher_group on students (teacher_id, group_id);
create index if not exists idx_attendance_student_status on attendance (student_id, status);
create index if not exists idx_session_occurrences_group_date on session_occurrences (group_id, session_date);
create index if not exists idx_submissions_exam on submissions (exam_id);
create index if not exists idx_questions_teacher on questions (teacher_id);
create index if not exists idx_exams_token on exams (public_token);

-- Absence view: counts absences that were NOT made up
create or replace view student_absences as
select a.teacher_id, a.student_id, o.session_date, o.id as occurrence_id
from attendance a
join session_occurrences o on o.id = a.occurrence_id
where a.status = 'absent'
  and o.status != 'cancelled'
  and not exists (
    select 1 from attendance m
    where m.student_id = a.student_id
      and m.makeup_of = a.occurrence_id
      and m.status in ('present','late')
  );

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

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

-- Drop existing policies if re-running
drop policy if exists teachers_read on teachers;
drop policy if exists teachers_write on teachers;
create policy teachers_read on teachers for select
  using (id = auth.uid() or is_admin());
create policy teachers_write on teachers for all
  using (is_admin())
  with check (is_admin());

-- Groups policies
drop policy if exists groups_read on groups;
drop policy if exists groups_write on groups;
create policy groups_read on groups for select
  using (teacher_id = auth.uid());
create policy groups_write on groups for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Group sessions (child of groups)
drop policy if exists gs_read on group_sessions;
drop policy if exists gs_write on group_sessions;
create policy gs_read on group_sessions for select
  using (exists (select 1 from groups g where g.id = group_id and g.teacher_id = auth.uid()));
create policy gs_write on group_sessions for all
  using (exists (select 1 from groups g where g.id = group_id and g.teacher_id = auth.uid()) and is_teacher_active(auth.uid()))
  with check (exists (select 1 from groups g where g.id = group_id and g.teacher_id = auth.uid()) and is_teacher_active(auth.uid()));

-- Students policies
drop policy if exists students_read on students;
drop policy if exists students_write on students;
create policy students_read on students for select
  using (teacher_id = auth.uid());
create policy students_write on students for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Session occurrences policies
drop policy if exists so_read on session_occurrences;
drop policy if exists so_write on session_occurrences;
create policy so_read on session_occurrences for select
  using (teacher_id = auth.uid());
create policy so_write on session_occurrences for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Attendance policies
drop policy if exists att_read on attendance;
drop policy if exists att_write on attendance;
create policy att_read on attendance for select
  using (teacher_id = auth.uid());
create policy att_write on attendance for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Make-up requests policies
drop policy if exists mr_read on makeup_requests;
drop policy if exists mr_write on makeup_requests;
create policy mr_read on makeup_requests for select
  using (teacher_id = auth.uid());
create policy mr_write on makeup_requests for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Questions policies
drop policy if exists q_read on questions;
drop policy if exists q_write on questions;
create policy q_read on questions for select
  using (teacher_id = auth.uid());
create policy q_write on questions for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Exams policies
drop policy if exists ex_read on exams;
drop policy if exists ex_write on exams;
create policy ex_read on exams for select
  using (teacher_id = auth.uid());
create policy ex_write on exams for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Exam questions policies
drop policy if exists eq_read on exam_questions;
drop policy if exists eq_write on exam_questions;
create policy eq_read on exam_questions for select
  using (exists (select 1 from exams e where e.id = exam_id and e.teacher_id = auth.uid()));
create policy eq_write on exam_questions for all
  using (exists (select 1 from exams e where e.id = exam_id and e.teacher_id = auth.uid()) and is_teacher_active(auth.uid()))
  with check (exists (select 1 from exams e where e.id = exam_id and e.teacher_id = auth.uid()) and is_teacher_active(auth.uid()));

-- Submissions policies
drop policy if exists sub_read on submissions;
drop policy if exists sub_write on submissions;
create policy sub_read on submissions for select
  using (teacher_id = auth.uid());
create policy sub_write on submissions for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));

-- Answers policies
drop policy if exists ans_read on answers;
drop policy if exists ans_write on answers;
create policy ans_read on answers for select
  using (exists (select 1 from submissions s where s.id = submission_id and s.teacher_id = auth.uid()));
create policy ans_write on answers for all
  using (exists (select 1 from submissions s where s.id = submission_id and s.teacher_id = auth.uid()) and is_teacher_active(auth.uid()))
  with check (exists (select 1 from submissions s where s.id = submission_id and s.teacher_id = auth.uid()) and is_teacher_active(auth.uid()));

-- Message log policies
drop policy if exists ml_read on message_log;
drop policy if exists ml_write on message_log;
create policy ml_read on message_log for select
  using (teacher_id = auth.uid());
create policy ml_write on message_log for all
  using (teacher_id = auth.uid() and is_teacher_active(auth.uid()))
  with check (teacher_id = auth.uid() and is_teacher_active(auth.uid()));
