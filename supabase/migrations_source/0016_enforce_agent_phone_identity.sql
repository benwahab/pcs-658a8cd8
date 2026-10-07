-- Agent phone is the login identifier.
-- Normalize it at creation time and prevent duplicate active agent numbers.

create unique index if not exists field_agents_active_phone_normalized_uidx
  on public.field_agents(phone_normalized)
  where is_active and phone_normalized is not null;

create index if not exists field_agents_phone_normalized_idx
  on public.field_agents(phone_normalized);

drop index if exists public.field_agents_phone_normalized_uidx;
