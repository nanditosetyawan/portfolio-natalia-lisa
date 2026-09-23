-- Reset published revisions and detach drafts
create or replace function public.reset_site_to_default()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  -- Archive currently published revisions
  update public.site_revisions
  set status = 'archived'
  where status = 'published';

  -- Sever the base_revision link for any existing drafts so they can be published cleanly
  update public.site_revisions
  set base_revision_number = null
  where status = 'draft';
end;
$$;

revoke execute on function public.reset_site_to_default() from public;
grant execute on function public.reset_site_to_default() to authenticated;
