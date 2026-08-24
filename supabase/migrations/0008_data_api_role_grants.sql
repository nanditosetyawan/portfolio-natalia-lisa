-- Expose the existing RLS-protected application tables to the Data API roles.
-- Privileges are deliberately narrower than the RLS policies: anon receives SELECT only,
-- while authenticated receives DML that remains guarded by private.is_admin().

grant usage on schema public to anon, authenticated;

grant select on table
  public.portfolio_profile,
  public.about_sections,
  public.about_paragraphs,
  public.education_sections,
  public.college_entries,
  public.shs_entries,
  public.experiences,
  public.certificate_sections,
  public.certificates,
  public.certificate_images,
  public.contact_profiles,
  public.navigation_items,
  public.navigation_config,
  public.media_assets,
  public.entity_media,
  public.photo_frames,
  public.entity_visual_configs
to anon, authenticated;

grant insert, update, delete on table
  public.portfolio_profile,
  public.about_sections,
  public.about_paragraphs,
  public.education_sections,
  public.college_entries,
  public.shs_entries,
  public.experiences,
  public.certificate_sections,
  public.certificates,
  public.certificate_images,
  public.contact_profiles,
  public.navigation_items,
  public.navigation_config,
  public.media_assets,
  public.entity_media,
  public.photo_frames,
  public.entity_visual_configs
to authenticated;
