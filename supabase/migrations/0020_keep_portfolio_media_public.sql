-- Phase 029G decision correction: portfolio-media remains PUBLIC.
-- Remove the temporary metadata policies introduced while private-bucket
-- conversion was being considered. This migration does not update the bucket
-- row and does not change its visibility.

drop policy if exists portfolio_media_admin_bucket_read on storage.buckets;
drop policy if exists portfolio_media_admin_bucket_update on storage.buckets;

notify pgrst, 'reload schema';
