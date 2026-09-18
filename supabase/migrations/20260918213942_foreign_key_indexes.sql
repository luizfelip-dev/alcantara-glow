create index appointments_client_id_idx
  on public.appointments (client_id);

create index payments_appointment_id_idx
  on public.payments (appointment_id);
