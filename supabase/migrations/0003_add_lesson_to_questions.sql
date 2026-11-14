-- Migration: Add optional lesson column to questions table
-- (Backwards-compatible: existing questions without lesson inherit from topic or null)
alter table questions add column if not exists lesson text;
