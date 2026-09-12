-- Keep reminder notifications in the persistent queue and reschedule them when an appointment moves.

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

    if new.starts_at > now() then
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
        'reminder'::public.notification_type,
        'scheduled'::public.notification_status,
        new.starts_at - interval '24 hours'
      );
    end if;

  elsif tg_op = 'UPDATE'
    and new.status = 'cancelled'
    and old.status is distinct from 'cancelled' then

    update public.notifications
       set status = 'cancelled'::public.notification_status,
           updated_at = now()
     where appointment_id = new.id
       and type = 'reminder'::public.notification_type
       and status = 'scheduled'::public.notification_status;

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

  elsif tg_op = 'UPDATE'
    and new.status <> 'cancelled'
    and old.starts_at is distinct from new.starts_at then

    update public.notifications
       set status = 'cancelled'::public.notification_status,
           updated_at = now()
     where appointment_id = new.id
       and type = 'reminder'::public.notification_type
       and status = 'scheduled'::public.notification_status;

    if new.starts_at > now() then
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
        'reminder'::public.notification_type,
        'scheduled'::public.notification_status,
        new.starts_at - interval '24 hours'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_create_notifications on public.appointments;

create trigger appointments_create_notifications
after insert or update of starts_at, status on public.appointments
for each row
execute function public.create_appointment_notifications();
