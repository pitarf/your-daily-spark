-- Keep the live Supabase security rules reproducible from source control.
-- These are RESTRICTIVE policies: they are combined with the existing
-- establishment/member policies using AND, so a professional can only see
-- the rows that belong to their own professional scope.

create or replace function public.current_establishment_role(p_establishment_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select eu.role::text
  from public.establishment_users eu
  where eu.establishment_id = p_establishment_id
    and eu.user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_establishment_professional_id(p_establishment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.professionals p
  where p.establishment_id = p_establishment_id
    and p.user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_establishment_role(uuid) to authenticated;
grant execute on function public.current_establishment_professional_id(uuid) to authenticated;

-- Appointments: a professional can only access their own appointments.
drop policy if exists professional_scope_appointments on public.appointments;
create policy professional_scope_appointments
on public.appointments as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id = public.current_establishment_professional_id(establishment_id)
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id = public.current_establishment_professional_id(establishment_id)
);

-- Blocks: a professional sees general blocks and their own blocks, never a
-- different professional's private block.
drop policy if exists professional_scope_blocked_slots on public.blocked_slots;
create policy professional_scope_blocked_slots
on public.blocked_slots as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
);

-- Customers: a professional only sees customers with an appointment assigned
-- to that professional in the same establishment.
drop policy if exists professional_scope_customers on public.customers;
create policy professional_scope_customers
on public.customers as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.establishment_id = customers.establishment_id
      and a.customer_id = customers.id
      and a.professional_id = public.current_establishment_professional_id(customers.establishment_id)
  )
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.establishment_id = customers.establishment_id
      and a.customer_id = customers.id
      and a.professional_id = public.current_establishment_professional_id(customers.establishment_id)
  )
);

-- Professional profile: only the logged-in professional's profile row.
drop policy if exists professional_scope_professionals on public.professionals;
create policy professional_scope_professionals
on public.professionals as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or id = public.current_establishment_professional_id(establishment_id)
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or id = public.current_establishment_professional_id(establishment_id)
);

-- Services: a professional only sees services they are linked to.
drop policy if exists professional_scope_services on public.services;
create policy professional_scope_services
on public.services as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.professional_services ps
    where ps.service_id = services.id
      and ps.professional_id = public.current_establishment_professional_id(services.establishment_id)
  )
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.professional_services ps
    where ps.service_id = services.id
      and ps.professional_id = public.current_establishment_professional_id(services.establishment_id)
  )
);

-- Service links: only the professional's own links are visible/writable.
drop policy if exists professional_scope_professional_services on public.professional_services;
create policy professional_scope_professional_services
on public.professional_services as restrictive for all to authenticated
using (
  coalesce(
    public.current_establishment_role(
      (select p.establishment_id from public.professionals p where p.id = professional_services.professional_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or professional_id = public.current_establishment_professional_id(
    (select p.establishment_id from public.professionals p where p.id = professional_services.professional_id limit 1)
  )
)
with check (
  coalesce(
    public.current_establishment_role(
      (select p.establishment_id from public.professionals p where p.id = professional_services.professional_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or professional_id = public.current_establishment_professional_id(
    (select p.establishment_id from public.professionals p where p.id = professional_services.professional_id limit 1)
  )
);

-- Weekly schedules: general schedule plus the professional's own schedule.
drop policy if exists professional_scope_weekly_schedules on public.weekly_schedules;
create policy professional_scope_weekly_schedules
on public.weekly_schedules as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
);

-- Breaks follow the schedule's scope.
drop policy if exists professional_scope_schedule_breaks on public.schedule_breaks;
create policy professional_scope_schedule_breaks
on public.schedule_breaks as restrictive for all to authenticated
using (
  coalesce(
    public.current_establishment_role(
      (select ws.establishment_id from public.weekly_schedules ws where ws.id = schedule_breaks.weekly_schedule_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or exists (
    select 1
    from public.weekly_schedules ws
    where ws.id = schedule_breaks.weekly_schedule_id
      and (
        ws.professional_id is null
        or ws.professional_id = public.current_establishment_professional_id(ws.establishment_id)
      )
  )
)
with check (
  coalesce(
    public.current_establishment_role(
      (select ws.establishment_id from public.weekly_schedules ws where ws.id = schedule_breaks.weekly_schedule_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or exists (
    select 1
    from public.weekly_schedules ws
    where ws.id = schedule_breaks.weekly_schedule_id
      and (
        ws.professional_id is null
        or ws.professional_id = public.current_establishment_professional_id(ws.establishment_id)
      )
  )
);

-- Exceptions follow the same general-or-own-professional rule.
drop policy if exists professional_scope_schedule_exceptions on public.schedule_exceptions;
create policy professional_scope_schedule_exceptions
on public.schedule_exceptions as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or professional_id is null
  or professional_id = public.current_establishment_professional_id(establishment_id)
);

-- Plan data is administrative. Professionals must not enumerate the
-- establishment's plans or plan/service catalog.
drop policy if exists professional_scope_customer_plans on public.customer_plans;
create policy professional_scope_customer_plans
on public.customer_plans as restrictive for all to authenticated
using (coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional')
with check (coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional');

drop policy if exists professional_scope_customer_plan_services on public.customer_plan_services;
create policy professional_scope_customer_plan_services
on public.customer_plan_services as restrictive for all to authenticated
using (
  coalesce(
    public.current_establishment_role(
      (select cp.establishment_id from public.customer_plans cp where cp.id = customer_plan_services.plan_id limit 1)
    ),
    'none'
  ) <> 'professional'
)
with check (
  coalesce(
    public.current_establishment_role(
      (select cp.establishment_id from public.customer_plans cp where cp.id = customer_plan_services.plan_id limit 1)
    ),
    'none'
  ) <> 'professional'
);

-- A professional can access an assignment only when that customer has an
-- appointment assigned to them.
drop policy if exists professional_scope_customer_plan_assignments on public.customer_plan_assignments;
create policy professional_scope_customer_plan_assignments
on public.customer_plan_assignments as restrictive for all to authenticated
using (
  coalesce(
    public.current_establishment_role(
      (select c.establishment_id from public.customers c where c.id = customer_plan_assignments.customer_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.customer_id = customer_plan_assignments.customer_id
      and a.professional_id = public.current_establishment_professional_id(a.establishment_id)
  )
)
with check (
  coalesce(
    public.current_establishment_role(
      (select c.establishment_id from public.customers c where c.id = customer_plan_assignments.customer_id limit 1)
    ),
    'none'
  ) <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.customer_id = customer_plan_assignments.customer_id
      and a.professional_id = public.current_establishment_professional_id(a.establishment_id)
  )
);

-- Notifications follow the professional's appointments.
drop policy if exists professional_scope_notifications on public.notifications;
create policy professional_scope_notifications
on public.notifications as restrictive for all to authenticated
using (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.id = notifications.appointment_id
      and a.professional_id = public.current_establishment_professional_id(notifications.establishment_id)
  )
)
with check (
  coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional'
  or exists (
    select 1
    from public.appointments a
    where a.id = notifications.appointment_id
      and a.professional_id = public.current_establishment_professional_id(notifications.establishment_id)
  )
);

-- Team membership: a professional may only read their own membership row.
drop policy if exists professional_scope_establishment_users on public.establishment_users;
create policy professional_scope_establishment_users
on public.establishment_users as restrictive for all to authenticated
using (coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional' or user_id = auth.uid())
with check (coalesce(public.current_establishment_role(establishment_id), 'none') <> 'professional' or user_id = auth.uid());
