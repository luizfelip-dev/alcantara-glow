alter table public.appointments
  add column service_time time without time zone,
  add column status text;

update public.appointments
set status = case
  when service_date < current_date then 'completed'
  else 'scheduled'
end
where status is null;

alter table public.appointments
  alter column status set default 'scheduled',
  alter column status set not null,
  add constraint appointments_status_check
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled'));

create index appointments_user_schedule_idx
  on public.appointments (user_id, service_date, service_time);
