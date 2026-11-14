-- Migration 0004: Add phone (student phone number) to students table
alter table if exists public.students
add column if not exists phone text;

comment on column public.students.phone is 'Student personal phone number (optional)';
