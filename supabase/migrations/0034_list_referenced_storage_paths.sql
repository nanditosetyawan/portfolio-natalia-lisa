-- Expose read-only admin helper to list all normalized portfolio-media object paths
-- still referenced across all site_revisions statuses (draft, published, archived),
-- media_assets, certificate_images, entity_media, and photo_frames.
-- Kept SECURITY INVOKER at public boundary with privileged SECURITY DEFINER
-- reader isolated inside private schema.

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
    -- 1a. site_revisions: snapshot.media.references[] (storagePath and uri)
    select ref ->> 'storagePath'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(revision.snapshot #> '{media,references}') = 'array'
            then revision.snapshot #> '{media,references}'
          else '[]'::jsonb
        end
      ) as ref
    where revision.status in ('draft', 'published', 'archived')
      and (nullif(pg_catalog.btrim(coalesce(ref ->> 'bucket', '')), '') is null or ref ->> 'bucket' = 'portfolio-media')

    union all

    select ref ->> 'uri'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(revision.snapshot #> '{media,references}') = 'array'
            then revision.snapshot #> '{media,references}'
          else '[]'::jsonb
        end
      ) as ref
    where revision.status in ('draft', 'published', 'archived')
      and (nullif(pg_catalog.btrim(coalesce(ref ->> 'bucket', '')), '') is null or ref ->> 'bucket' = 'portfolio-media')

    union all

    -- 1b. site_revisions: snapshot.certificateCards[].thumbnail.source
    select card #>> '{thumbnail,source}'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(revision.snapshot -> 'certificateCards') = 'array'
            then revision.snapshot -> 'certificateCards'
          else '[]'::jsonb
        end
      ) as card
    where revision.status in ('draft', 'published', 'archived')

    union all

    -- 1c. site_revisions: snapshot.certificateCards[].detailImages[].source
    select detail ->> 'source'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(revision.snapshot -> 'certificateCards') = 'array'
            then revision.snapshot -> 'certificateCards'
          else '[]'::jsonb
        end
      ) as card,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(card -> 'detailImages') = 'array'
            then card -> 'detailImages'
          else '[]'::jsonb
        end
      ) as detail
    where revision.status in ('draft', 'published', 'archived')

    union all

    -- 1d. site_revisions: legacy v1 snapshot.mediaAssets[].source fallback
    select legacy_asset ->> 'source'
    from public.site_revisions as revision,
      lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(revision.snapshot -> 'mediaAssets') = 'array'
            then revision.snapshot -> 'mediaAssets'
          else '[]'::jsonb
        end
      ) as legacy_asset
    where revision.status in ('draft', 'published', 'archived')

    union all

    -- 2. media_assets rows
    select asset.storage_path
    from public.media_assets as asset
    where asset.storage_bucket is null or asset.storage_bucket = 'portfolio-media'

    union all

    select asset.source_url
    from public.media_assets as asset
    where asset.storage_bucket is null or asset.storage_bucket = 'portfolio-media'

    union all

    -- 3. Active relational join bindings (entity_media / photo_frames / certificate_images)
    select asset.storage_path
    from public.entity_media as em
    join public.media_assets as asset on asset.id = em.media_asset_id
    where asset.storage_bucket is null or asset.storage_bucket = 'portfolio-media'

    union all

    select asset.storage_path
    from public.photo_frames as pf
    join public.media_assets as asset on asset.id = pf.media_asset_id
    where asset.storage_bucket is null or asset.storage_bucket = 'portfolio-media'

    union all

    select asset.storage_path
    from public.certificate_images as ci
    join public.media_assets as asset on asset.id = ci.media_asset_id
    where asset.storage_bucket is null or asset.storage_bucket = 'portfolio-media'

    union all

    -- Defensive certificate asset fallback matching AdminCertificates storage layout
    select concat('published/certificates/', pg_catalog.btrim(ci.media_asset_id), '.webp')
    from public.certificate_images as ci
    where nullif(pg_catalog.btrim(ci.media_asset_id), '') is not null
  ),
  cleaned as (
    select ltrim(btrim(split_part(split_part(raw_value, '#', 1), '?', 1)), '/') as candidate
    from raw_candidates
    where raw_value is not null
      and pg_catalog.btrim(raw_value) <> ''
      and raw_value !~* '^(?:data|blob):'
  ),
  normalized as (
    select
      case
        when candidate ~* '^(?:https?://[^/]+/)?storage/v1/object/(?:(?:public|sign|authenticated)/)?portfolio-media/.+$'
          then ltrim((pg_catalog.regexp_match(
            candidate,
            '^(?:https?://[^/]+/)?storage/v1/object/(?:(?:public|sign|authenticated)/)?portfolio-media/(.+)$',
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

create or replace function public.list_referenced_storage_paths()
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select private.is_admin()) is not true then
    raise exception 'Admin access required';
  end if;

  return private.list_referenced_storage_paths_internal();
end;
$$;

revoke execute on function public.list_referenced_storage_paths() from public, anon;
grant execute on function public.list_referenced_storage_paths() to authenticated;

notify pgrst, 'reload schema';

