-- Migration 0005: Track exam session termination reason (e.g., left_session)
alter table if exists public.submissions
add column if not exists termination_reason text;

comment on column public.submissions.termination_reason is 'Reason if session was auto-ended (e.g., left_session)';
