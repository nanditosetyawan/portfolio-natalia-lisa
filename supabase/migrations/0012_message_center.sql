-- Phase 026: database-backed message center with server-side TTL and rate limiting.

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  email text null check (email is null or char_length(email) <= 320),
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz null,
  is_saved boolean not null default false,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent text null,
  status text not null default 'new' check (status in ('new', 'read'))
);

create index messages_created_at_idx on public.messages (created_at desc);
create index messages_expires_at_idx on public.messages (expires_at)
  where is_saved = false and expires_at is not null;
create index messages_ip_hash_created_at_idx on public.messages (ip_hash, created_at desc);

alter table public.messages enable row level security;

create or replace function private.prepare_message_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  client_ip text := coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip', 'unknown');
  first_ip text := split_part(client_ip, ',', 1);
  recent_count integer;
begin
  new.created_at := now();
  new.updated_at := new.created_at;
  new.is_saved := false;
  new.expires_at := new.created_at + interval '30 days';
  new.status := 'new';
  new.ip_hash := encode(extensions.digest(btrim(first_ip), 'sha256'), 'hex');
  new.user_agent := left(headers ->> 'user-agent', 1024);

  select count(*)::integer into recent_count
  from public.messages
  where ip_hash = new.ip_hash
    and created_at >= now() - interval '24 hours';

  if recent_count >= 5 then
    raise sqlstate 'PT429' using
      message = 'You have reached today''s message limit. Please try again tomorrow.';
  end if;

  return new;
end;
$$;

create or replace function private.prepare_message_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.name is distinct from old.name
    or new.email is distinct from old.email
    or new.message is distinct from old.message
    or new.created_at is distinct from old.created_at
    or new.ip_hash is distinct from old.ip_hash
    or new.user_agent is distinct from old.user_agent
    or new.status is distinct from old.status then
    raise exception 'Message content and audit fields cannot be edited';
  end if;

  new.updated_at := now();
  new.expires_at := case when new.is_saved then null else new.updated_at + interval '30 days' end;
  return new;
end;
$$;

create or replace function private.purge_expired_messages()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  deleted_count integer;
begin
  delete from public.messages
  where is_saved = false
    and expires_at is not null
    and expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

drop trigger if exists messages_prepare_insert on public.messages;
create trigger messages_prepare_insert
before insert on public.messages
for each row execute function private.prepare_message_insert();

drop trigger if exists messages_prepare_update on public.messages;
create trigger messages_prepare_update
before update on public.messages
for each row execute function private.prepare_message_update();

drop policy if exists messages_anon_insert on public.messages;
create policy messages_anon_insert on public.messages
for insert to anon
with check (is_saved = false and expires_at is not null);

drop policy if exists messages_admin_select on public.messages;
create policy messages_admin_select on public.messages
for select to authenticated
using ((select private.is_admin()));

drop policy if exists messages_admin_update on public.messages;
create policy messages_admin_update on public.messages
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists messages_admin_delete on public.messages;
create policy messages_admin_delete on public.messages
for delete to authenticated
using ((select private.is_admin()));

grant select on public.messages to authenticated;
grant insert on public.messages to anon;
grant update, delete on public.messages to authenticated;

revoke all on function private.prepare_message_insert() from public, anon, authenticated;
revoke all on function private.prepare_message_update() from public, anon, authenticated;
revoke all on function private.purge_expired_messages() from public, anon, authenticated;

select cron.schedule(
  'messages-auto-delete',
  '*/15 * * * *',
  $$select private.purge_expired_messages();$$
);
