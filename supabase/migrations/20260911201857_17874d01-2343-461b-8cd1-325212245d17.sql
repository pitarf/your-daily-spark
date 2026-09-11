revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_establishment_member(uuid) from public, anon;
revoke all on function public.has_establishment_role(uuid, public.establishment_role) from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_schedule_exception() from public, anon, authenticated;
revoke all on function public.validate_plan_assignment() from public, anon, authenticated;
revoke all on function public.check_appointment_conflicts() from public, anon, authenticated;
revoke all on function public.check_blocked_slot_conflicts() from public, anon, authenticated;