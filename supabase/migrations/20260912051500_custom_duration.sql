alter table public.establishments
  add column if not exists allow_custom_duration boolean not null default false;

alter table public.appointments
  add column if not exists duration_minutes_override integer;

alter table public.appointments
  drop constraint if exists appointments_duration_override_check;

alter table public.appointments
  add constraint appointments_duration_override_check
  check (duration_minutes_override is null or duration_minutes_override > 0);
