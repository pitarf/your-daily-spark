-- Persist a presentation preset independently from the semantic business type.
-- "auto" keeps the business-specific theme that is already in use.

alter table public.establishments
  add column if not exists theme_preset text not null default 'auto';

alter table public.establishments
  drop constraint if exists establishments_theme_preset_check;

alter table public.establishments
  add constraint establishments_theme_preset_check
  check (theme_preset in ('auto', 'minimal', 'soft', 'bold', 'dark', 'warm'));
