create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_memberships
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

grant usage on schema private to authenticated;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_memberships enable row level security;
alter table public.portfolio_profile enable row level security;
alter table public.about_sections enable row level security;
alter table public.about_paragraphs enable row level security;
alter table public.education_sections enable row level security;
alter table public.college_entries enable row level security;
alter table public.shs_entries enable row level security;
alter table public.experiences enable row level security;
alter table public.certificate_sections enable row level security;
alter table public.certificates enable row level security;
alter table public.contact_profiles enable row level security;
alter table public.navigation_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.entity_media enable row level security;
alter table public.photo_frames enable row level security;
alter table public.certificate_images enable row level security;
alter table public.entity_visual_configs enable row level security;

create policy admin_memberships_admin_all on public.admin_memberships
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy portfolio_profile_public_read on public.portfolio_profile
  for select to anon, authenticated using (active);
create policy portfolio_profile_admin_all on public.portfolio_profile
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy about_sections_public_read on public.about_sections
  for select to anon, authenticated using (active);
create policy about_sections_admin_all on public.about_sections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy about_paragraphs_public_read on public.about_paragraphs
  for select to anon, authenticated using (active and exists (select 1 from public.about_sections s where s.id = about_section_id and s.active));
create policy about_paragraphs_admin_all on public.about_paragraphs
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy education_sections_public_read on public.education_sections
  for select to anon, authenticated using (active);
create policy education_sections_admin_all on public.education_sections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy college_entries_public_read on public.college_entries
  for select to anon, authenticated using (active);
create policy college_entries_admin_all on public.college_entries
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy shs_entries_public_read on public.shs_entries
  for select to anon, authenticated using (active);
create policy shs_entries_admin_all on public.shs_entries
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy experiences_public_read on public.experiences
  for select to anon, authenticated using (active);
create policy experiences_admin_all on public.experiences
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy certificate_sections_public_read on public.certificate_sections
  for select to anon, authenticated using (active);
create policy certificate_sections_admin_all on public.certificate_sections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy certificates_public_read on public.certificates
  for select to anon, authenticated using (active);
create policy certificates_admin_all on public.certificates
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy certificate_images_public_read on public.certificate_images
  for select to anon, authenticated using (exists (select 1 from public.certificates c where c.id = certificate_id and c.active));
create policy certificate_images_admin_all on public.certificate_images
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy contact_profiles_public_read on public.contact_profiles
  for select to anon, authenticated using (active);
create policy contact_profiles_admin_all on public.contact_profiles
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy navigation_items_public_read on public.navigation_items
  for select to anon, authenticated using (visible);
create policy navigation_items_admin_all on public.navigation_items
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy media_assets_public_read on public.media_assets
  for select to anon, authenticated using (true);
create policy media_assets_admin_all on public.media_assets
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy entity_media_public_read on public.entity_media
  for select to anon, authenticated using (true);
create policy entity_media_admin_all on public.entity_media
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy photo_frames_public_read on public.photo_frames
  for select to anon, authenticated using (true);
create policy photo_frames_admin_all on public.photo_frames
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy entity_visual_configs_public_read on public.entity_visual_configs
  for select to anon, authenticated using (true);
create policy entity_visual_configs_admin_all on public.entity_visual_configs
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
