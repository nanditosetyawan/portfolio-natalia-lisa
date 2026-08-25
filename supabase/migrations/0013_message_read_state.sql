-- Phase 027: server-persisted Admin Message read state.

alter table public.messages
  add column if not exists read_at timestamptz null;

create index if not exists messages_read_at_idx
  on public.messages (read_at);
