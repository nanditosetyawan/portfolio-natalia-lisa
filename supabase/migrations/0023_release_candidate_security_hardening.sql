-- Phase 037: close release-candidate privilege and bootstrap races without
-- changing the application data model or repository contracts.

-- RLS does not protect TRUNCATE. Data API roles only need the DML privileges
-- granted by the application migrations, so remove unrelated table powers.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables
  from anon, authenticated;

-- Trigger and event-trigger helpers are invoked by PostgreSQL, not by Data API
-- clients. Their default PUBLIC execute grants are unnecessary.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated, service_role;
revoke execute on function private.touch_updated_at()
  from public, anon, authenticated, service_role;
revoke execute on function public.enforce_editor_draft_limit()
  from public, anon, authenticated, service_role;
revoke execute on function public.enforce_editor_favorite_limit()
  from public, anon, authenticated, service_role;

-- Serialize the one-time first-admin decision. Without this transaction lock,
-- two first-install callers could both pass the empty-membership check.
create or replace function public.bootstrap_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'authenticated user required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('portfolio.bootstrap_first_admin', 0)
  );

  if exists (select 1 from public.admin_memberships) then
    return false;
  end if;

  insert into public.admin_memberships (user_id, role)
  values (caller_id, 'admin')
  on conflict (user_id) do nothing;

  return exists (
    select 1
    from public.admin_memberships
    where user_id = caller_id
      and role = 'admin'
  );
end;
$$;

revoke execute on function public.bootstrap_first_admin() from public, anon;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- The check already guarded every new write. Validation certifies the existing
-- history as well so the release has no deferred integrity checks.
alter table public.site_revisions
  validate constraint site_revisions_published_metadata_check;

notify pgrst, 'reload schema';
