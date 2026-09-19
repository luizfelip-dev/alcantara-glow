select jsonb_build_object(
  'products', (select count(*) from public.products),
  'appointments', (select count(*) from public.appointments),
  'expenses', (select count(*) from public.expenses),
  'settings', (select count(*) from public.studio_settings),
  'clients', (select count(*) from public.clients),
  'payments', (select count(*) from public.payments),
  'appointments_without_client', (
    select count(*) from public.appointments where client_id is null
  ),
  'appointments_without_status', (
    select count(*) from public.appointments where status is null
  ),
  'appointments_without_payment', (
    select count(*)
    from public.appointments appointment
    where not exists (
      select 1
      from public.payments payment
      where payment.appointment_id = appointment.id
    )
  ),
  'payments_with_wrong_owner', (
    select count(*)
    from public.payments payment
    join public.appointments appointment on appointment.id = payment.appointment_id
    where payment.user_id <> appointment.user_id
  )
) as postflight;
