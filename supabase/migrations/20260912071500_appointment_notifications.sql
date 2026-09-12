-- Queue in-app notification records whenever an appointment is created or cancelled.
-- The trigger is SECURITY DEFINER because public booking must not need direct
-- notification write permissions.

create or replace function public.create_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (
      establishment_id,
      customer_id,
      appointment_id,
      type,
      status,
      scheduled_at
    )
    values (
      new.establishment_id,
      new.customer_id,
      new.id,
      'confirmation'::public.notification_type,
      'scheduled'::public.notification_status,
      now()
    );
  elsif tg_op = 'UPDATE'
    and new.status = 'cancelled'
    and old.status is distinct from 'cancelled' then
    insert into public.notifications (
      establishment_id,
      customer_id,
      appointment_id,
      type,
      status,
      scheduled_at
    )
    values (
      new.establishment_id,
      new.customer_id,
      new.id,
      'cancellation'::public.notification_type,
      'scheduled'::public.notification_status,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_create_notifications on public.appointments;

create trigger appointments_create_notifications
after insert or update of status on public.appointments
for each row
execute function public.create_appointment_notifications();
