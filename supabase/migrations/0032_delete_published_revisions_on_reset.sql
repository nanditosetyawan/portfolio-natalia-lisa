-- Delete published and legacy archived revisions on reset while preserving all drafts.
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
  set status = 'archived'
  where status = 'published';

  update public.site_revisions
  set rollback_source_revision_id = null
  where status = 'archived'
    and rollback_source_revision_id is not null;

  delete from public.site_revisions
  where status = 'archived';

  update public.site_revisions
  set base_revision_number = null,
      updated_at = now()
  where status = 'draft'
    and base_revision_number is not null;
end;
$$;

revoke execute on function private.reset_site_to_default_internal() from public, anon;
grant execute on function private.reset_site_to_default_internal() to authenticated;

notify pgrst, 'reload schema';
