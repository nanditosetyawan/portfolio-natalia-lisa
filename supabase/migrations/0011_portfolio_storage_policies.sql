-- Storage object policies for the single public-delivery portfolio bucket.
-- The bucket itself must be created through the supported Storage API; this migration
-- only defines least-privilege object policies and never inserts into storage tables.

create policy portfolio_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'portfolio-media');

create policy portfolio_media_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio-media'
    and (select private.is_admin())
  );

create policy portfolio_media_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (select private.is_admin())
  )
  with check (
    bucket_id = 'portfolio-media'
    and (select private.is_admin())
  );

create policy portfolio_media_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (select private.is_admin())
  );
