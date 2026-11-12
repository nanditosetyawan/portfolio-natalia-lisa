-- Persistent cross-browser Design System workspace storage for authenticated admins.

create table if not exists public.design_system_workspaces (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  workspace jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_system_workspace_object_check check (
    jsonb_typeof(workspace) = 'object'
    and (workspace ->> 'version') = '1'
    and jsonb_typeof(workspace -> 'themes') = 'array'
    and pg_catalog.octet_length(workspace::text) <= 2097152
  )
);

alter table public.design_system_workspaces enable row level security;

revoke all on table public.design_system_workspaces from public, anon;
grant select, insert, update, delete on table public.design_system_workspaces to authenticated;

drop policy if exists "Admins can manage own design system workspace" on public.design_system_workspaces;
create policy "Admins can manage own design system workspace"
  on public.design_system_workspaces
  for all
  to authenticated
  using ((select private.is_admin()) and user_id = (select auth.uid()))
  with check ((select private.is_admin()) and user_id = (select auth.uid()));

drop trigger if exists touch_design_system_workspaces on public.design_system_workspaces;
create trigger touch_design_system_workspaces
  before update on public.design_system_workspaces
  for each row execute function private.touch_updated_at();

notify pgrst, 'reload schema';

