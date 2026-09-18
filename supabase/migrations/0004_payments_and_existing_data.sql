create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  appointment_id bigint not null references public.appointments(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  kind text not null check (kind in ('deposit', 'partial', 'final', 'full')),
  paid_at date not null default current_date,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now()
);

create index payments_user_appointment_date_idx
  on public.payments (user_id, appointment_id, paid_at desc);

alter table public.payments enable row level security;

create policy payments_select_own on public.payments
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy payments_insert_own on public.payments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.appointments
      where appointments.id = payments.appointment_id
        and appointments.user_id = (select auth.uid())
    )
  );

revoke all on public.payments from anon;
grant select, insert on public.payments to authenticated;
grant usage, select on sequence public.payments_id_seq to authenticated;

insert into public.payments (
  user_id,
  appointment_id,
  amount_cents,
  kind,
  paid_at,
  note
)
select
  appointments.user_id,
  appointments.id,
  appointments.amount_cents,
  'full',
  appointments.service_date,
  'Pagamento preservado da versão anterior'
from public.appointments;
