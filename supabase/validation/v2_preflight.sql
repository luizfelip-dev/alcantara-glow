select jsonb_build_object(
  'products', (select count(*) from public.products),
  'appointments', (select count(*) from public.appointments),
  'expenses', (select count(*) from public.expenses),
  'settings', (select count(*) from public.studio_settings),
  'distinct_clients_to_create', (
    select count(*)
    from (
      select user_id, lower(trim(client_name))
      from public.appointments
      group by user_id, lower(trim(client_name))
    ) clients
  ),
  'appointments_without_owner', (
    select count(*) from public.appointments where user_id is null
  ),
  'products_without_owner', (
    select count(*) from public.products where user_id is null
  )
) as preflight;
