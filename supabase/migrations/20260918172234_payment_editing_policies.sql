create policy payments_update_own on public.payments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.appointments
      where appointments.id = payments.appointment_id
        and appointments.user_id = (select auth.uid())
    )
  );

create policy payments_delete_own on public.payments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant update, delete on public.payments to authenticated;
