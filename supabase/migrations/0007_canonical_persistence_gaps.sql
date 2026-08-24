-- Evidence-backed additions for the canonical Phase 011 runtime model.
-- Existing application tables are preserved; this migration only adds missing persistence fields
-- and one narrowly-scoped owner for navigation metadata.

alter table public.college_entries
  add column label text not null,
  add column frame_back_id text not null,
  add column frame_front_id text not null;

alter table public.shs_entries
  add column label text not null,
  add column frame_back_id text not null,
  add column frame_front_id text not null;

alter table public.photo_frames
  add column section text not null default '',
  add column label text not null default '',
  add column object_position text not null default 'center center';

alter table public.certificate_sections
  add column autoplay boolean not null default true,
  add column slideshow_interval_ms integer not null default 3000,
  add constraint certificate_sections_slideshow_interval_ms_check
    check (slideshow_interval_ms >= 250);

create table public.navigation_config (
  id text primary key check (id = 'navigation'),
  brand text not null,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint navigation_config_sections_array_check
    check (jsonb_typeof(sections) = 'array')
);

alter table public.navigation_config enable row level security;

create policy navigation_config_public_read on public.navigation_config
  for select to anon using (true);

create policy navigation_config_authenticated_read on public.navigation_config
  for select to authenticated using (true);

create policy navigation_config_admin_insert on public.navigation_config
  for insert to authenticated
  with check ((select private.is_admin()));

create policy navigation_config_admin_update on public.navigation_config
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy navigation_config_admin_delete on public.navigation_config
  for delete to authenticated
  using ((select private.is_admin()));

create index navigation_config_updated_at_idx
  on public.navigation_config (updated_at);
