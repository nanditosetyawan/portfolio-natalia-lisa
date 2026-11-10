-- Restore safe Reset Published Site behavior:
-- 1) Release live published status by archiving published revisions (no new rows inserted or deleted)
-- 2) Keep drafts and favorites intact while detaching base_revision_number
-- 3) Preserve media_assets, certificates, and certificate_images
create or replace function public.reset_site_to_default()
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

revoke execute on function public.reset_site_to_default() from public, anon;
grant execute on function public.reset_site_to_default() to authenticated;

notify pgrst, 'reload schema';

