-- Migration 0006: Add exam display language ('ar' | 'en') to exams table
alter table if exists public.exams
add column if not exists language text not null default 'ar'
check (language in ('ar', 'en'));

comment on column public.exams.language is 'Exam display language and directionality: ar (RTL / س١) or en (LTR / Q1)';
