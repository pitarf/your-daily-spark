create extension if not exists btree_gist;

-- ENUMS
create type public.establishment_role as enum ('admin', 'professional', 'staff');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.schedule_exception_type as enum ('closed', 'custom_hours');
create type public.notification_type as enum ('reminder', 'confirmation', 'cancellation');
create type public.notification_status as enum ('scheduled', 'sent', 'failed', 'cancelled');

-- SHARED TRIGGER FN
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ESTABLISHMENTS
create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'other',
  description text,
  logo_url text,
  phone text,
  whatsapp text,
  email text,
  address text,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index establishments_active_idx on public.establishments(active);
grant select, insert, update, delete on public.establishments to authenticated;
grant select on public.establishments to anon;
grant all on public.establishments to service_role;
alter table public.establishments enable row level security;
create trigger establishments_updated_at before update on public.establishments for each row execute function public.set_updated_at();

-- ESTABLISHMENT USERS
create table public.establishment_users (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.establishment_role not null default 'professional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, user_id)
);
create index establishment_users_user_idx on public.establishment_users(user_id);
create index establishment_users_establishment_idx on public.establishment_users(establishment_id);
grant select, insert, update, delete on public.establishment_users to authenticated;
grant all on public.establishment_users to service_role;
alter table public.establishment_users enable row level security;
create trigger establishment_users_updated_at before update on public.establishment_users for each row execute function public.set_updated_at();

-- SECURITY DEFINER HELPERS
create or replace function public.is_establishment_member(_establishment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.establishment_users
    where establishment_id = _establishment_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_establishment_role(_establishment_id uuid, _role public.establishment_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.establishment_users
    where establishment_id = _establishment_id and user_id = auth.uid() and role = _role
  );
$$;

-- establishments policies
create policy "establishments_public_read_active" on public.establishments for select to anon using (active = true);
create policy "establishments_member_read" on public.establishments for select to authenticated using (active = true or public.is_establishment_member(id));
create policy "establishments_admin_update" on public.establishments for update to authenticated using (public.has_establishment_role(id, 'admin')) with check (public.has_establishment_role(id, 'admin'));
create policy "establishments_admin_delete" on public.establishments for delete to authenticated using (public.has_establishment_role(id, 'admin'));
create policy "establishments_authenticated_insert" on public.establishments for insert to authenticated with check (true);

-- establishment_users policies
create policy "establishment_users_read_own_membership" on public.establishment_users for select to authenticated using (user_id = auth.uid() or public.is_establishment_member(establishment_id));
create policy "establishment_users_admin_write" on public.establishment_users for insert to authenticated with check (public.has_establishment_role(establishment_id, 'admin') or not exists (select 1 from public.establishment_users eu where eu.establishment_id = establishment_users.establishment_id));
create policy "establishment_users_admin_update" on public.establishment_users for update to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));
create policy "establishment_users_admin_delete" on public.establishment_users for delete to authenticated using (public.has_establishment_role(establishment_id, 'admin'));

-- PROFESSIONALS
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  photo_url text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index professionals_establishment_idx on public.professionals(establishment_id);
grant select, insert, update, delete on public.professionals to authenticated;
grant select on public.professionals to anon;
grant all on public.professionals to service_role;
alter table public.professionals enable row level security;
create trigger professionals_updated_at before update on public.professionals for each row execute function public.set_updated_at();
create policy "professionals_public_read" on public.professionals for select to anon using (active = true);
create policy "professionals_member_read" on public.professionals for select to authenticated using (active = true or public.is_establishment_member(establishment_id));
create policy "professionals_admin_write" on public.professionals for all to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));

-- SERVICES
create table public.services (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_establishment_idx on public.services(establishment_id);
grant select, insert, update, delete on public.services to authenticated;
grant select on public.services to anon;
grant all on public.services to service_role;
alter table public.services enable row level security;
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create policy "services_public_read" on public.services for select to anon using (active = true);
create policy "services_member_read" on public.services for select to authenticated using (active = true or public.is_establishment_member(establishment_id));
create policy "services_admin_write" on public.services for all to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));

-- PROFESSIONAL SERVICES
create table public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);
create index professional_services_service_idx on public.professional_services(service_id);
grant select, insert, update, delete on public.professional_services to authenticated;
grant select on public.professional_services to anon;
grant all on public.professional_services to service_role;
alter table public.professional_services enable row level security;
create policy "professional_services_public_read" on public.professional_services for select to anon using (true);
create policy "professional_services_member_read" on public.professional_services for select to authenticated using (true);
create policy "professional_services_admin_write" on public.professional_services for all to authenticated
  using (exists (select 1 from public.professionals p where p.id = professional_id and public.has_establishment_role(p.establishment_id, 'admin')))
  with check (exists (select 1 from public.professionals p where p.id = professional_id and public.has_establishment_role(p.establishment_id, 'admin')));

-- WEEKLY SCHEDULES
create table public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index weekly_schedules_establishment_idx on public.weekly_schedules(establishment_id, weekday);
create index weekly_schedules_professional_idx on public.weekly_schedules(professional_id);
grant select, insert, update, delete on public.weekly_schedules to authenticated;
grant select on public.weekly_schedules to anon;
grant all on public.weekly_schedules to service_role;
alter table public.weekly_schedules enable row level security;
create trigger weekly_schedules_updated_at before update on public.weekly_schedules for each row execute function public.set_updated_at();
create policy "weekly_schedules_public_read" on public.weekly_schedules for select to anon using (active = true);
create policy "weekly_schedules_member_read" on public.weekly_schedules for select to authenticated using (active = true or public.is_establishment_member(establishment_id));
create policy "weekly_schedules_admin_write" on public.weekly_schedules for all to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));

-- SCHEDULE BREAKS
create table public.schedule_breaks (
  id uuid primary key default gen_random_uuid(),
  weekly_schedule_id uuid not null references public.weekly_schedules(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index schedule_breaks_schedule_idx on public.schedule_breaks(weekly_schedule_id);
grant select, insert, update, delete on public.schedule_breaks to authenticated;
grant select on public.schedule_breaks to anon;
grant all on public.schedule_breaks to service_role;
alter table public.schedule_breaks enable row level security;
create policy "schedule_breaks_public_read" on public.schedule_breaks for select to anon using (true);
create policy "schedule_breaks_member_read" on public.schedule_breaks for select to authenticated using (true);
create policy "schedule_breaks_admin_write" on public.schedule_breaks for all to authenticated
  using (exists (select 1 from public.weekly_schedules w where w.id = weekly_schedule_id and public.has_establishment_role(w.establishment_id, 'admin')))
  with check (exists (select 1 from public.weekly_schedules w where w.id = weekly_schedule_id and public.has_establishment_role(w.establishment_id, 'admin')));

-- SCHEDULE EXCEPTIONS
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  date date not null,
  type public.schedule_exception_type not null default 'closed',
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index schedule_exceptions_establishment_idx on public.schedule_exceptions(establishment_id, date);
grant select, insert, update, delete on public.schedule_exceptions to authenticated;
grant select on public.schedule_exceptions to anon;
grant all on public.schedule_exceptions to service_role;
alter table public.schedule_exceptions enable row level security;
create trigger schedule_exceptions_updated_at before update on public.schedule_exceptions for each row execute function public.set_updated_at();
create policy "schedule_exceptions_public_read" on public.schedule_exceptions for select to anon using (true);
create policy "schedule_exceptions_member_read" on public.schedule_exceptions for select to authenticated using (true);
create policy "schedule_exceptions_admin_write" on public.schedule_exceptions for all to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));

create or replace function public.validate_schedule_exception()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.type = 'custom_hours' then
    if new.start_time is null or new.end_time is null or new.end_time <= new.start_time then
      raise exception 'custom_hours exception requires a valid start_time/end_time range';
    end if;
  end if;
  return new;
end;
$$;
create trigger schedule_exceptions_validate before insert or update on public.schedule_exceptions for each row execute function public.validate_schedule_exception();

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_establishment_idx on public.customers(establishment_id);
create unique index customers_establishment_phone_idx on public.customers(establishment_id, phone) where phone is not null;
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create policy "customers_member_read" on public.customers for select to authenticated using (public.is_establishment_member(establishment_id) or user_id = auth.uid());
create policy "customers_staff_write" on public.customers for all to authenticated using (public.is_establishment_member(establishment_id)) with check (public.is_establishment_member(establishment_id));

-- CUSTOMER PLANS
create table public.customer_plans (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  description text,
  duration_limit_minutes integer check (duration_limit_minutes is null or duration_limit_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_plans_establishment_idx on public.customer_plans(establishment_id);
grant select, insert, update, delete on public.customer_plans to authenticated;
grant all on public.customer_plans to service_role;
alter table public.customer_plans enable row level security;
create trigger customer_plans_updated_at before update on public.customer_plans for each row execute function public.set_updated_at();
create policy "customer_plans_member_read" on public.customer_plans for select to authenticated using (public.is_establishment_member(establishment_id));
create policy "customer_plans_admin_write" on public.customer_plans for all to authenticated using (public.has_establishment_role(establishment_id, 'admin')) with check (public.has_establishment_role(establishment_id, 'admin'));

create table public.customer_plan_services (
  plan_id uuid not null references public.customer_plans(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, service_id)
);
grant select, insert, update, delete on public.customer_plan_services to authenticated;
grant all on public.customer_plan_services to service_role;
alter table public.customer_plan_services enable row level security;
create policy "customer_plan_services_member_read" on public.customer_plan_services for select to authenticated
  using (exists (select 1 from public.customer_plans cp where cp.id = plan_id and public.is_establishment_member(cp.establishment_id)));
create policy "customer_plan_services_admin_write" on public.customer_plan_services for all to authenticated
  using (exists (select 1 from public.customer_plans cp where cp.id = plan_id and public.has_establishment_role(cp.establishment_id, 'admin')))
  with check (exists (select 1 from public.customer_plans cp where cp.id = plan_id and public.has_establishment_role(cp.establishment_id, 'admin')));

create table public.customer_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plan_id uuid not null references public.customer_plans(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_plan_assignments_customer_idx on public.customer_plan_assignments(customer_id);
create index customer_plan_assignments_plan_idx on public.customer_plan_assignments(plan_id);
grant select, insert, update, delete on public.customer_plan_assignments to authenticated;
grant all on public.customer_plan_assignments to service_role;
alter table public.customer_plan_assignments enable row level security;
create trigger customer_plan_assignments_updated_at before update on public.customer_plan_assignments for each row execute function public.set_updated_at();
create policy "customer_plan_assignments_member_read" on public.customer_plan_assignments for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and public.is_establishment_member(c.establishment_id)));
create policy "customer_plan_assignments_staff_write" on public.customer_plan_assignments for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and public.is_establishment_member(c.establishment_id)))
  with check (exists (select 1 from public.customers c where c.id = customer_id and public.is_establishment_member(c.establishment_id)));

create or replace function public.validate_plan_assignment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.expires_at is not null and new.expires_at <= new.starts_at then
    raise exception 'expires_at must be after starts_at';
  end if;
  return new;
end;
$$;
create trigger customer_plan_assignments_validate before insert or update on public.customer_plan_assignments for each row execute function public.validate_plan_assignment();

-- BLOCKED SLOTS
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index blocked_slots_establishment_idx on public.blocked_slots(establishment_id, starts_at);
create index blocked_slots_professional_idx on public.blocked_slots(professional_id, starts_at);
grant select, insert, update, delete on public.blocked_slots to authenticated;
grant all on public.blocked_slots to service_role;
alter table public.blocked_slots enable row level security;
create policy "blocked_slots_member_read" on public.blocked_slots for select to authenticated using (public.is_establishment_member(establishment_id));
create policy "blocked_slots_staff_write" on public.blocked_slots for all to authenticated using (public.is_establishment_member(establishment_id)) with check (public.is_establishment_member(establishment_id));

-- APPOINTMENTS
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
create index appointments_establishment_idx on public.appointments(establishment_id, starts_at);
create index appointments_professional_idx on public.appointments(professional_id, starts_at);
create index appointments_customer_idx on public.appointments(customer_id);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create policy "appointments_member_read" on public.appointments for select to authenticated
  using (public.is_establishment_member(establishment_id) or exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));
create policy "appointments_staff_write" on public.appointments for all to authenticated using (public.is_establishment_member(establishment_id)) with check (public.is_establishment_member(establishment_id));

-- conflicts against blocked slots (cross-table, so trigger based)
create or replace function public.check_appointment_conflicts()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;
  if exists (
    select 1 from public.blocked_slots b
    where b.establishment_id = new.establishment_id
      and (b.professional_id is null or b.professional_id = new.professional_id)
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'appointment conflicts with a blocked slot';
  end if;
  return new;
end;
$$;
create trigger appointments_check_conflicts before insert or update on public.appointments for each row execute function public.check_appointment_conflicts();

create or replace function public.check_blocked_slot_conflicts()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.appointments a
    where a.establishment_id = new.establishment_id
      and (new.professional_id is null or a.professional_id = new.professional_id)
      and a.status in ('pending', 'confirmed', 'completed')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'blocked slot conflicts with an existing appointment';
  end if;
  return new;
end;
$$;
create trigger blocked_slots_check_conflicts before insert or update on public.blocked_slots for each row execute function public.check_blocked_slot_conflicts();

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type public.notification_type not null,
  status public.notification_status not null default 'scheduled',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_establishment_idx on public.notifications(establishment_id, scheduled_at);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create trigger notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create policy "notifications_member_read" on public.notifications for select to authenticated using (public.is_establishment_member(establishment_id));
create policy "notifications_staff_write" on public.notifications for all to authenticated using (public.is_establishment_member(establishment_id)) with check (public.is_establishment_member(establishment_id));

-- ============ SEED ============
insert into public.establishments (id, name, slug, business_type, description, phone, whatsapp, email, address, timezone, active)
values ('11111111-1111-4111-8111-111111111111', 'Barbearia Marca Minha Vez', 'barbearia-marca-minha-vez', 'barbershop',
        'Barbearia demonstrativa do Marca Minha Vez.', '(11) 90000-0000', '(11) 90000-0000', 'contato@marcaminhavez.app',
        'Rua Exemplo, 123 - São Paulo/SP', 'America/Sao_Paulo', true);

insert into public.services (id, establishment_id, name, description, duration_minutes, price, active) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-111111111111', 'Corte', 'Corte de cabelo masculino', 30, 35.00, true),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-111111111111', 'Barba', 'Barba completa', 30, 25.00, true),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-111111111111', 'Corte + Barba', 'Combo corte e barba', 60, 55.00, true),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-111111111111', 'Platinado', 'Descoloração e platinado', 120, 120.00, true);

insert into public.professionals (id, establishment_id, name, description, active) values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-111111111111', 'João', 'Barbeiro', true),
  ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-111111111111', 'Carlos', 'Barbeiro', true);

insert into public.professional_services (professional_id, service_id)
select p.id, s.id from public.professionals p
cross join public.services s
where p.establishment_id = '11111111-1111-4111-8111-111111111111'
  and s.establishment_id = '11111111-1111-4111-8111-111111111111';

insert into public.weekly_schedules (id, establishment_id, professional_id, weekday, start_time, end_time, active) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-111111111111', null, 1, '09:00', '18:00', true),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-111111111111', null, 2, '09:00', '18:00', true),
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-111111111111', null, 3, '09:00', '18:00', true),
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-111111111111', null, 4, '09:00', '18:00', true),
  ('44444444-4444-4444-8444-000000000005', '11111111-1111-4111-8111-111111111111', null, 5, '09:00', '18:00', true),
  ('44444444-4444-4444-8444-000000000006', '11111111-1111-4111-8111-111111111111', null, 6, '09:00', '14:00', true);

insert into public.schedule_breaks (weekly_schedule_id, start_time, end_time)
select id, '12:00', '13:00' from public.weekly_schedules where weekday between 1 and 5 and establishment_id = '11111111-1111-4111-8111-111111111111';