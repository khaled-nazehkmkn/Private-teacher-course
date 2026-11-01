-- Migration: Add optional model_answer column to questions table
-- (Note: the application safely stores essay model answers in 'correct' jsonb column by default,
-- so running this migration is optional and backwards-compatible)
alter table questions add column if not exists model_answer text;
