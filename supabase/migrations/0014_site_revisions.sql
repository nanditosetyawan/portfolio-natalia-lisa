-- Phase 029B: snapshot boundary for draft and published editor revisions.
create table if not exists public.site_revisions (
  id uuid primary key default gen_random_uuid(),
  revision_number bigint not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  snapshot jsonb not null,
  base_revision_number bigint,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (revision_number, status)
);

create index if not exists site_revisions_status_revision_idx
  on public.site_revisions (status, revision_number desc);

alter table public.site_revisions enable row level security;

create policy "Admins can read site revisions"
  on public.site_revisions for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can create site revisions"
  on public.site_revisions for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

create policy "Admins can update site revisions"
  on public.site_revisions for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, insert, update on public.site_revisions to authenticated;

