create index about_paragraphs_section_order_idx on public.about_paragraphs (about_section_id, order_index);
create index college_entries_order_idx on public.college_entries (order_index) where active;
create index shs_entries_order_idx on public.shs_entries (order_index) where active;
create index experiences_order_idx on public.experiences (order_index) where active;
create index certificates_order_idx on public.certificates (order_index) where active;
create index certificate_images_certificate_order_idx on public.certificate_images (certificate_id, order_index);
create index entity_media_owner_idx on public.entity_media (owner_type, owner_id);
create index photo_frames_owner_idx on public.photo_frames (owner_type, owner_id);
create index entity_visual_configs_entity_idx on public.entity_visual_configs (entity_type, entity_id);
