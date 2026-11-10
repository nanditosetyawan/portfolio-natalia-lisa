-- Harden private.list_referenced_storage_paths_internal() to scan all JSONB string
-- values recursively across all site_revisions statuses/fields plus auxiliary JSONB
-- configs, media_assets, entity_media, photo_frames, certificate_images, and cta links.

create or replace function private.list_referenced_storage_paths_internal()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text[];
begin
  if (select auth.uid()) is null or (select private.is_admin()) is not true then
    raise exception 'Admin access required';
  end if;

  with raw_candidates(raw_value) as (
    -- 1. Exhaustive recursive JSONB string scan across ALL site_revisions rows
    select val #>> '{}'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_path_query(revision.snapshot, '$.** ? (@.type() == "string")') as val

    union all

    -- 2. Auxiliary JSONB config columns
    select val #>> '{}'
    from public.entity_visual_configs as evc,
      lateral pg_catalog.jsonb_path_query(evc.config, '$.** ? (@.type() == "string")') as val

    union all

    select val #>> '{}'
    from public.photo_frames as pf,
      lateral pg_catalog.jsonb_path_query(pf.visual_config, '$.** ? (@.type() == "string")') as val

    union all

    select val #>> '{}'
    from public.photo_frames as pf,
      lateral pg_catalog.jsonb_path_query(pf.placeholder_config, '$.** ? (@.type() == "string")') as val

    union all

    select val #>> '{}'
    from public.certificate_images as ci,
      lateral pg_catalog.jsonb_path_query(ci.placeholder_config, '$.** ? (@.type() == "string")') as val

    union all

    select val #>> '{}'
    from public.navigation_config as nc,
      lateral pg_catalog.jsonb_path_query(nc.sections, '$.** ? (@.type() == "string")') as val

    union all

    -- 3. media_assets rows (storage_path and source_url)
    select asset.storage_path
    from public.media_assets as asset
    where nullif(pg_catalog.btrim(coalesce(asset.storage_bucket, '')), '') is null
       or pg_catalog.lower(pg_catalog.btrim(asset.storage_bucket)) = 'portfolio-media'

    union all

    select asset.source_url
    from public.media_assets as asset
    where nullif(pg_catalog.btrim(coalesce(asset.storage_bucket, '')), '') is null
       or pg_catalog.lower(pg_catalog.btrim(asset.storage_bucket)) = 'portfolio-media'
       or asset.source_url ~* 'portfolio-media/'

    union all

    -- 4. Active relational joins (entity_media / photo_frames / certificate_images)
    select asset.storage_path
    from public.entity_media as em
    join public.media_assets as asset on asset.id = em.media_asset_id
    where nullif(pg_catalog.btrim(coalesce(asset.storage_bucket, '')), '') is null
       or pg_catalog.lower(pg_catalog.btrim(asset.storage_bucket)) = 'portfolio-media'

    union all

    select asset.source_url
    from public.entity_media as em
    join public.media_assets as asset on asset.id = em.media_asset_id

    union all

    select asset.storage_path
    from public.photo_frames as pf
    join public.media_assets as asset on asset.id = pf.media_asset_id
    where nullif(pg_catalog.btrim(coalesce(asset.storage_bucket, '')), '') is null
       or pg_catalog.lower(pg_catalog.btrim(asset.storage_bucket)) = 'portfolio-media'

    union all

    select asset.source_url
    from public.photo_frames as pf
    join public.media_assets as asset on asset.id = pf.media_asset_id

    union all

    select asset.storage_path
    from public.certificate_images as ci
    join public.media_assets as asset on asset.id = ci.media_asset_id
    where nullif(pg_catalog.btrim(coalesce(asset.storage_bucket, '')), '') is null
       or pg_catalog.lower(pg_catalog.btrim(asset.storage_bucket)) = 'portfolio-media'

    union all

    -- Defensive fallback for certificate image storage layouts (published and draft paths)
    select 'published/certificates/' || pg_catalog.btrim(ci.media_asset_id) || '.webp'
    from public.certificate_images as ci
    where nullif(pg_catalog.btrim(ci.media_asset_id), '') is not null

    union all

    select 'draft/certificates/' || pg_catalog.btrim(ci.media_asset_id) || '.webp'
    from public.certificate_images as ci
    where nullif(pg_catalog.btrim(ci.media_asset_id), '') is not null

    union all

    -- 5. Canonical CTA href in case a CV/PDF/file in portfolio-media is linked directly
    select cp.cta_href
    from public.contact_profiles as cp
    where cp.cta_href is not null
  ),
  cleaned as (
    select pg_catalog.ltrim(pg_catalog.btrim(pg_catalog.split_part(pg_catalog.split_part(raw_value, '#', 1), '?', 1)), '/') as candidate
    from raw_candidates
    where raw_value is not null
      and pg_catalog.char_length(raw_value) between 1 and 4096
      and pg_catalog.btrim(raw_value) <> ''
      and pg_catalog.btrim(raw_value) !~* '^(?:data|blob):'
  ),
  normalized as (
    select
      case
        when candidate ~* '^(?:[a-z]+://[^/]+/|[^/]*[.:][^/]*/)?storage/v1/(?:object|render/image)/(?:(?:public|sign|authenticated)/)?portfolio-media/.+$'
          then pg_catalog.ltrim((pg_catalog.regexp_match(
            candidate,
            '^(?:[a-z]+://[^/]+/|[^/]*[.:][^/]*/)?storage/v1/(?:object|render/image)/(?:(?:public|sign|authenticated)/)?portfolio-media/(.+)$',
            'i'
          ))[1], '/')
        when candidate ~* '^portfolio-media/(?:draft|published|portfolio)/.+$'
          then pg_catalog.ltrim((pg_catalog.regexp_match(
            candidate,
            '^portfolio-media/((?:draft|published|portfolio)/.+)$',
            'i'
          ))[1], '/')
        when candidate ~* '^(?:draft|published|portfolio)/.+$'
          then candidate
        else null
      end as storage_path
    from cleaned
  )
  select coalesce(pg_catalog.array_agg(distinct storage_path order by storage_path), array[]::text[])
    into result
  from normalized
  where storage_path is not null
    and storage_path <> '';

  return coalesce(result, array[]::text[]);
end;
$$;

revoke execute on function private.list_referenced_storage_paths_internal() from public, anon;
grant execute on function private.list_referenced_storage_paths_internal() to authenticated;

notify pgrst, 'reload schema';

