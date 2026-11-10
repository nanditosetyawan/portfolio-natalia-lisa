-- Harden message rate-limit against X-Forwarded-For spoofing, concurrent races,
-- multi-row bulk POST arrays, and unbounded Free-Tier table growth.

create or replace function private.prepare_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(pg_catalog.current_setting('request.headers', true), ''), '{}')::jsonb;
  cf_ip text := nullif(pg_catalog.btrim(coalesce(headers ->> 'cf-connecting-ip', '')), '');
  xff_raw text := pg_catalog.btrim(coalesce(headers ->> 'x-forwarded-for', ''), ' ,');
  xff_last text := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(xff_raw, '^.*,', '')), '');
  real_ip text := nullif(pg_catalog.btrim(coalesce(headers ->> 'x-real-ip', '')), '');
  client_ip text := coalesce(cf_ip, xff_last, real_ip, 'unknown');
  recent_ip_count integer;
  recent_global_count integer;
  unsaved_backlog_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('portfolio.messages.insert', 0)
  );

  new.created_at := now();
  new.updated_at := new.created_at;
  new.is_saved := false;
  new.expires_at := new.created_at + interval '30 days';
  new.status := 'new';
  new.read_at := null;
  new.ip_hash := pg_catalog.encode(extensions.digest(client_ip, 'sha256'), 'hex');
  new.user_agent := pg_catalog.left(headers ->> 'user-agent', 1024);

  select pg_catalog.count(*)::integer into recent_ip_count
  from public.messages
  where ip_hash = new.ip_hash
    and created_at >= now() - interval '24 hours';

  if recent_ip_count >= 5 then
    raise sqlstate 'PT429' using
      message = 'You have reached today''s message limit. Please try again tomorrow.';
  end if;

  -- shortcut: fixed hourly/backlog safety caps assume low portfolio traffic;
  -- replace with Turnstile + Edge Function if genuine multi-IP traffic exceeds 30/hour.
  select pg_catalog.count(*)::integer into recent_global_count
  from public.messages
  where created_at >= now() - interval '1 hour';

  if recent_global_count >= 30 then
    raise sqlstate 'PT429' using
      message = 'Too many messages received right now. Please try again later.';
  end if;

  select pg_catalog.count(*)::integer into unsaved_backlog_count
  from public.messages
  where is_saved = false
    and expires_at is not null;

  if unsaved_backlog_count >= 500 then
    raise sqlstate 'PT429' using
      message = 'Message storage limit reached. Please try again later.';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_message_insert_batch_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select pg_catalog.count(*) from inserted) <= 1 then
    return null;
  end if;

  if exists (
    select 1
    from (select distinct ip_hash from inserted) as batch_ips
    join public.messages as m on m.ip_hash = batch_ips.ip_hash
    where m.created_at >= now() - interval '24 hours'
    group by m.ip_hash
    having pg_catalog.count(*) > 5
  ) then
    raise sqlstate 'PT429' using
      message = 'You have reached today''s message limit. Please try again tomorrow.';
  end if;

  if (
    select pg_catalog.count(*)
    from public.messages
    where created_at >= now() - interval '1 hour'
  ) > 30 then
    raise sqlstate 'PT429' using
      message = 'Too many messages received right now. Please try again later.';
  end if;

  if (
    select pg_catalog.count(*)
    from public.messages
    where is_saved = false
      and expires_at is not null
  ) > 500 then
    raise sqlstate 'PT429' using
      message = 'Message storage limit reached. Please try again later.';
  end if;

  return null;
end;
$$;

create or replace trigger messages_enforce_batch_limits
after insert on public.messages
referencing new table as inserted
for each statement execute function private.enforce_message_insert_batch_limits();

revoke all on function private.prepare_message_insert() from public, anon, authenticated, service_role;
revoke all on function private.enforce_message_insert_batch_limits() from public, anon, authenticated, service_role;
