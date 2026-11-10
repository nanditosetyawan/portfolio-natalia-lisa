-- Keep exposed RPC as SECURITY INVOKER while isolating privileged site_revisions update
-- inside private schema to satisfy Supabase database security advisor lint 0029.
create or replace function private.reset_site_to_default_internal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select private.is_admin()) is not true then
    raise exception 'Admin access required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('site-revisions-publish-boundary', 0)
  );

  update public.site_revisions
  set status = 'archived',
      updated_at = now()
  where status = 'published';

  update public.site_revisions
  set base_revision_number = null,
      updated_at = now()
  where status = 'draft'
    and base_revision_number is not null;
end;
$$;

revoke execute on function private.reset_site_to_default_internal() from public, anon;
grant execute on function private.reset_site_to_default_internal() to authenticated;

create or replace function public.reset_site_to_default()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select private.is_admin()) is not true then
    raise exception 'Admin access required';
  end if;

  perform private.reset_site_to_default_internal();
end;
$$;

revoke execute on function public.reset_site_to_default() from public, anon;
grant execute on function public.reset_site_to_default() to authenticated;

notify pgrst, 'reload schema';

