-- One-time first-admin bootstrap for the single-owner portfolio.
-- The caller must already be authenticated. After the first membership exists,
-- this function becomes a no-op and cannot grant additional admin access.

create or replace function public.bootstrap_first_admin()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'authenticated user required';
  end if;

  if exists (select 1 from public.admin_memberships) then
    return false;
  end if;

  insert into public.admin_memberships (user_id, role)
  values (caller_id, 'admin')
  on conflict (user_id) do nothing;

  return exists (
    select 1 from public.admin_memberships
    where user_id = caller_id and role = 'admin'
  );
end;
$$;

revoke execute on function public.bootstrap_first_admin() from public;
grant execute on function public.bootstrap_first_admin() to authenticated;
