create table public.clients (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text check (phone is null or length(trim(phone)) between 8 and 30),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column client_id bigint references public.clients(id) on delete set null;

create index clients_user_name_idx on public.clients (user_id, name);
create index appointments_user_client_idx on public.appointments (user_id, client_id);

alter table public.clients enable row level security;

create policy clients_select_own on public.clients
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy clients_insert_own on public.clients
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy clients_update_own on public.clients
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy clients_delete_own on public.clients
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy appointments_insert_own on public.appointments;
create policy appointments_insert_own on public.appointments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1
        from public.clients
        where clients.id = appointments.client_id
          and clients.user_id = (select auth.uid())
      )
    )
  );

drop policy appointments_update_own on public.appointments;
create policy appointments_update_own on public.appointments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1
        from public.clients
        where clients.id = appointments.client_id
          and clients.user_id = (select auth.uid())
      )
    )
  );

revoke all on public.clients from anon;
grant select, insert, update, delete on public.clients to authenticated;
grant usage, select on sequence public.clients_id_seq to authenticated;
