do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'portfolio_profile', 'about_sections', 'about_paragraphs', 'education_sections',
    'college_entries', 'shs_entries', 'experiences', 'certificate_sections',
    'certificates', 'certificate_images', 'contact_profiles', 'navigation_items',
    'media_assets', 'entity_media', 'photo_frames', 'entity_visual_configs'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
  end loop;
end $$;

alter policy portfolio_profile_public_read on public.portfolio_profile to anon;
alter policy about_sections_public_read on public.about_sections to anon;
alter policy about_paragraphs_public_read on public.about_paragraphs to anon;
alter policy education_sections_public_read on public.education_sections to anon;
alter policy college_entries_public_read on public.college_entries to anon;
alter policy shs_entries_public_read on public.shs_entries to anon;
alter policy experiences_public_read on public.experiences to anon;
alter policy certificate_sections_public_read on public.certificate_sections to anon;
alter policy certificates_public_read on public.certificates to anon;
alter policy certificate_images_public_read on public.certificate_images to anon;
alter policy contact_profiles_public_read on public.contact_profiles to anon;
alter policy navigation_items_public_read on public.navigation_items to anon;
alter policy media_assets_public_read on public.media_assets to anon;
alter policy entity_media_public_read on public.entity_media to anon;
alter policy photo_frames_public_read on public.photo_frames to anon;
alter policy entity_visual_configs_public_read on public.entity_visual_configs to anon;

create policy portfolio_profile_authenticated_read on public.portfolio_profile
  for select to authenticated using (active or (select private.is_admin()));
create policy about_sections_authenticated_read on public.about_sections
  for select to authenticated using (active or (select private.is_admin()));
create policy about_paragraphs_authenticated_read on public.about_paragraphs
  for select to authenticated using ((active and exists (select 1 from public.about_sections s where s.id = about_section_id and s.active)) or (select private.is_admin()));
create policy education_sections_authenticated_read on public.education_sections
  for select to authenticated using (active or (select private.is_admin()));
create policy college_entries_authenticated_read on public.college_entries
  for select to authenticated using (active or (select private.is_admin()));
create policy shs_entries_authenticated_read on public.shs_entries
  for select to authenticated using (active or (select private.is_admin()));
create policy experiences_authenticated_read on public.experiences
  for select to authenticated using (active or (select private.is_admin()));
create policy certificate_sections_authenticated_read on public.certificate_sections
  for select to authenticated using (active or (select private.is_admin()));
create policy certificates_authenticated_read on public.certificates
  for select to authenticated using (active or (select private.is_admin()));
create policy certificate_images_authenticated_read on public.certificate_images
  for select to authenticated using ((exists (select 1 from public.certificates c where c.id = certificate_id and c.active)) or (select private.is_admin()));
create policy contact_profiles_authenticated_read on public.contact_profiles
  for select to authenticated using (active or (select private.is_admin()));
create policy navigation_items_authenticated_read on public.navigation_items
  for select to authenticated using (visible or (select private.is_admin()));
create policy media_assets_authenticated_read on public.media_assets
  for select to authenticated using (true);
create policy entity_media_authenticated_read on public.entity_media
  for select to authenticated using (true);
create policy photo_frames_authenticated_read on public.photo_frames
  for select to authenticated using (true);
create policy entity_visual_configs_authenticated_read on public.entity_visual_configs
  for select to authenticated using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'portfolio_profile', 'about_sections', 'about_paragraphs', 'education_sections',
    'college_entries', 'shs_entries', 'experiences', 'certificate_sections',
    'certificates', 'certificate_images', 'contact_profiles', 'navigation_items',
    'media_assets', 'entity_media', 'photo_frames', 'entity_visual_configs'
  ] loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', table_name || '_admin_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', table_name || '_admin_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', table_name || '_admin_delete', table_name);
  end loop;
end $$;
