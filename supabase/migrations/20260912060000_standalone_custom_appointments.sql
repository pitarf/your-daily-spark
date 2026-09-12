-- Permite registrar atendimentos personalizados sem um serviço cadastrado.
-- O serviço continua obrigatório para agendamentos normais, mas pode ser nulo
-- quando o atendimento possuir um título personalizado.
alter table public.appointments
  alter column service_id drop not null;

alter table public.appointments
  add column if not exists custom_title text,
  add column if not exists custom_price numeric(10,2);

alter table public.appointments
  drop constraint if exists appointments_custom_booking_check;

alter table public.appointments
  add constraint appointments_custom_booking_check
  check (service_id is not null or nullif(trim(custom_title), '') is not null);

alter table public.appointments
  drop constraint if exists appointments_custom_price_check;

alter table public.appointments
  add constraint appointments_custom_price_check
  check (custom_price is null or custom_price >= 0);
