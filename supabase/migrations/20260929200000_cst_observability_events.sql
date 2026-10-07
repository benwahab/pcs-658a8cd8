create table if not exists public.cst_request_events (
  id bigint generated always as identity primary key,
  trace_id text not null,
  occurred_at timestamptz not null default now(),
  method text not null,
  endpoint text not null,
  status_code integer,
  latency_ms integer,
  source text not null default 'frontend',
  user_hash text,
  error_class text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists cst_request_events_occurred_at_idx on public.cst_request_events (occurred_at desc);
create index if not exists cst_request_events_trace_id_idx on public.cst_request_events (trace_id);
create index if not exists cst_request_events_endpoint_idx on public.cst_request_events (endpoint, occurred_at desc);
alter table public.cst_request_events enable row level security;
revoke all on public.cst_request_events from anon, authenticated;
create table if not exists public.cst_frontend_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  message text,
  page text,
  browser text,
  device text,
  trace_id text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists cst_frontend_events_occurred_at_idx on public.cst_frontend_events (occurred_at desc);
alter table public.cst_frontend_events enable row level security;
revoke all on public.cst_frontend_events from anon, authenticated;
