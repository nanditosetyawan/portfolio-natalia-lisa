-- Phase 029G: immutable Published history, atomic activation/rollback, and
-- draft/published Storage isolation. Storage object mutations remain the
-- responsibility of the supported Storage API; this migration only reads
-- object metadata and defines policies.

alter table public.site_revisions
  add column if not exists source_draft_revision_id uuid
    references public.site_revisions(id) on delete restrict,
  add column if not exists published_by uuid
    references auth.users(id) on delete restrict,
  add column if not exists publish_note text,
  add column if not exists publication_kind text,
  add column if not exists rollback_source_revision_id uuid
    references public.site_revisions(id) on delete restrict;

alter table public.site_revisions
  drop constraint if exists site_revisions_publish_note_check,
  add constraint site_revisions_publish_note_check
    check (publish_note is null or char_length(publish_note) <= 500),
  drop constraint if exists site_revisions_publication_kind_check,
  add constraint site_revisions_publication_kind_check
    check (publication_kind is null or publication_kind in ('publish', 'rollback')),
  drop constraint if exists site_revisions_published_metadata_check,
  add constraint site_revisions_published_metadata_check check (
    status <> 'published'
    or (
      published_at is not null
      and published_by is not null
      and publication_kind is not null
      and (
        (publication_kind = 'publish' and source_draft_revision_id is not null and rollback_source_revision_id is null)
        or (publication_kind = 'rollback' and rollback_source_revision_id is not null)
      )
    )
  ) not valid;

create index if not exists site_revisions_source_draft_idx
  on public.site_revisions (source_draft_revision_id)
  where source_draft_revision_id is not null;

create index if not exists site_revisions_published_by_idx
  on public.site_revisions (published_by, published_at desc)
  where status = 'published';

create index if not exists site_revisions_rollback_source_idx
  on public.site_revisions (rollback_source_revision_id)
  where rollback_source_revision_id is not null;

-- Only the narrow active-snapshot RPC below is exposed to anonymous clients.
-- Drafts and Published history remain protected by the existing Admin policy.
revoke select on public.site_revisions from anon;

create or replace function public.get_active_published_snapshot()
returns setof public.site_revisions
language sql
stable
security definer
set search_path = ''
as $$
  select revision.*
  from public.site_revisions as revision
  where revision.status = 'published'
  order by revision.revision_number desc
  limit 1;
$$;

revoke execute on function public.get_active_published_snapshot() from public;
grant execute on function public.get_active_published_snapshot() to anon, authenticated;

create or replace function public.publish_editor_draft(
  p_draft_id uuid,
  p_prepared_snapshot jsonb,
  p_expected_published_revision bigint,
  p_expected_draft_lock_version bigint,
  p_note text default null
)
returns setof public.site_revisions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_published bigint;
  draft_row public.site_revisions;
  next_published bigint;
  activated_id uuid;
  draft_media_shape jsonb;
  prepared_media_shape jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Publish note must be 500 characters or fewer.';
  end if;

  -- This lock is shared with Draft saves. It makes the compare-and-activate
  -- boundary serializable without holding a lock during Storage preparation.
  perform pg_advisory_xact_lock(hashtextextended('site-revisions-publish-boundary', 0));

  select max(revision.revision_number)
    into current_published
  from public.site_revisions as revision
  where revision.status = 'published';

  if current_published is distinct from p_expected_published_revision then
    raise exception 'The Published revision changed while this Draft was being prepared.' using errcode = '40001';
  end if;

  select revision.*
    into draft_row
  from public.site_revisions as revision
  where revision.id = p_draft_id
    and revision.status = 'draft'
    and revision.created_by = (select auth.uid())
  for update;

  if not found then
    raise exception 'Draft revision was not found.';
  end if;

  if p_expected_draft_lock_version is null
     or draft_row.lock_version <> p_expected_draft_lock_version then
    raise exception 'The Draft changed while Publish was being prepared.' using errcode = '40001';
  end if;

  if draft_row.base_revision_number is distinct from current_published then
    raise exception 'This Draft is based on an older Published revision.' using errcode = '40001';
  end if;

  if jsonb_typeof(p_prepared_snapshot) <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'compatibility') <> 'object'
     or p_prepared_snapshot #>> '{compatibility,schemaVersion}' <> '1'
     or jsonb_typeof(p_prepared_snapshot -> 'content') <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'entities') <> 'array'
     or jsonb_typeof(p_prepared_snapshot -> 'typography') <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'layout') <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'media') <> 'object'
     or jsonb_typeof(p_prepared_snapshot #> '{media,references}') <> 'array'
     or jsonb_typeof(p_prepared_snapshot #> '{media,assignments}') <> 'array'
     or jsonb_typeof(p_prepared_snapshot -> 'backgrounds') <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'buttons') <> 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'animations') <> 'object' then
    raise exception 'Published Snapshot structure is invalid.';
  end if;

  if btrim(coalesce(p_prepared_snapshot #>> '{content,portfolio,title}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,profile,name}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,about,title}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,education,title}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,experience,title}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,certificate,title}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,contact,line1}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,contact,line2}', '')) = ''
     or btrim(coalesce(p_prepared_snapshot #>> '{content,contact,cta,text}', '')) = '' then
    raise exception 'Published Snapshot is missing required text.';
  end if;

  if jsonb_array_length(p_prepared_snapshot -> 'entities') = 0
     or exists (
       select 1
       from jsonb_array_elements(p_prepared_snapshot -> 'entities') as entity(value)
       where jsonb_typeof(entity.value) <> 'object'
          or btrim(coalesce(entity.value ->> 'entityId', '')) = ''
          or btrim(coalesce(entity.value ->> 'section', '')) = ''
     )
     or (
       select count(*)
       from jsonb_array_elements(p_prepared_snapshot -> 'entities') as entity(value)
     ) <> (
       select count(distinct entity.value ->> 'entityId')
       from jsonb_array_elements(p_prepared_snapshot -> 'entities') as entity(value)
     ) then
    raise exception 'Published Snapshot entity references are invalid.';
  end if;

  if jsonb_array_length(p_prepared_snapshot #> '{media,references}') = 0
     or exists (
       select 1
       from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
       where jsonb_typeof(media_ref.value) <> 'object'
          or btrim(coalesce(media_ref.value ->> 'assetId', '')) = ''
          or media_ref.value ->> 'bucket' <> 'portfolio-media'
          or media_ref.value ->> 'storagePath' not like 'published/%'
          or media_ref.value ->> 'storagePath' like '%..%'
          or media_ref.value ->> 'uri' is distinct from media_ref.value ->> 'storagePath'
          or media_ref.value ->> 'mimeType' not like 'image/%'
     )
     or (
       select count(*)
       from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
     ) <> (
       select count(distinct media_ref.value ->> 'assetId')
       from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
     ) then
    raise exception 'Every Published media reference must be unique and use portfolio-media/published/*.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_prepared_snapshot #> '{media,assignments}') as assignment(value)
    where btrim(coalesce(assignment.value ->> 'entityId', '')) = ''
       or not exists (
         select 1
         from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
         where media_ref.value ->> 'assetId' = assignment.value ->> 'assetId'
       )
  ) then
    raise exception 'Published media assignments contain a missing asset or entity reference.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(p_prepared_snapshot #> '{media,assignments}') as assignment(value)
    where assignment.value ->> 'entityId' = p_prepared_snapshot #>> '{content,profile,mediaUsageId}'
  ) then
    raise exception 'The required profile image is missing.';
  end if;

  -- Database-side existence verification closes the activation race after the
  -- client has copied and downloaded every object through the Storage API.
  if exists (
    select 1
    from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
    where not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = media_ref.value ->> 'bucket'
        and object.name = media_ref.value ->> 'storagePath'
        and coalesce(object.metadata ->> 'mimetype', '') = media_ref.value ->> 'mimeType'
        and coalesce(object.metadata ->> 'size', '0') ~ '^[0-9]+$'
        and (object.metadata ->> 'size')::bigint > 0
        and object.owner_id = (select auth.uid())::text
    )
  ) then
    raise exception 'One or more prepared Published media objects are missing, empty, unowned, or have a MIME mismatch.';
  end if;

  -- Storage preparation may only replace physical media locations. It may not
  -- smuggle any unrelated content change into the activation transaction.
  if (draft_row.snapshot #- '{media,references}') is distinct from
     (p_prepared_snapshot #- '{media,references}') then
    raise exception 'Prepared Snapshot differs from the saved Draft outside media references.';
  end if;

  select coalesce(
    jsonb_agg(media_ref.value - 'uri' - 'bucket' - 'storagePath' order by media_ref.value ->> 'assetId'),
    '[]'::jsonb
  ) into draft_media_shape
  from jsonb_array_elements(draft_row.snapshot #> '{media,references}') as media_ref(value);

  select coalesce(
    jsonb_agg(media_ref.value - 'uri' - 'bucket' - 'storagePath' order by media_ref.value ->> 'assetId'),
    '[]'::jsonb
  ) into prepared_media_shape
  from jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value);

  if draft_media_shape is distinct from prepared_media_shape then
    raise exception 'Prepared media identity or metadata differs from the saved Draft.';
  end if;

  next_published := coalesce(current_published, 0) + 1;

  insert into public.site_revisions (
    revision_number,
    lock_version,
    status,
    snapshot,
    base_revision_number,
    created_by,
    published_at,
    source_draft_revision_id,
    published_by,
    publish_note,
    publication_kind
  ) values (
    next_published,
    1,
    'published',
    p_prepared_snapshot,
    current_published,
    (select auth.uid()),
    now(),
    draft_row.id,
    (select auth.uid()),
    nullif(btrim(p_note), ''),
    'publish'
  ) returning id into activated_id;

  return query
    select revision.*
    from public.site_revisions as revision
    where revision.id = activated_id;
end;
$$;

create or replace function public.rollback_published_revision(
  p_target_revision_id uuid,
  p_expected_published_revision bigint,
  p_note text default null
)
returns setof public.site_revisions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_published bigint;
  target_row public.site_revisions;
  activated_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Rollback note must be 500 characters or fewer.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('site-revisions-publish-boundary', 0));

  select max(revision.revision_number)
    into current_published
  from public.site_revisions as revision
  where revision.status = 'published';

  if current_published is distinct from p_expected_published_revision then
    raise exception 'The Published revision changed before Rollback could activate.' using errcode = '40001';
  end if;

  select revision.*
    into target_row
  from public.site_revisions as revision
  where revision.id = p_target_revision_id
    and revision.status = 'published';

  if not found then
    raise exception 'Published revision was not found.';
  end if;

  if current_published is null or target_row.revision_number >= current_published then
    raise exception 'Rollback must select an older Published revision.';
  end if;

  insert into public.site_revisions (
    revision_number,
    lock_version,
    status,
    snapshot,
    base_revision_number,
    created_by,
    published_at,
    source_draft_revision_id,
    published_by,
    publish_note,
    publication_kind,
    rollback_source_revision_id
  ) values (
    current_published + 1,
    1,
    'published',
    target_row.snapshot,
    current_published,
    (select auth.uid()),
    now(),
    target_row.source_draft_revision_id,
    (select auth.uid()),
    nullif(btrim(p_note), ''),
    'rollback',
    target_row.id
  ) returning id into activated_id;

  return query
    select revision.*
    from public.site_revisions as revision
    where revision.id = activated_id;
end;
$$;

revoke execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text) from public, anon;
revoke execute on function public.rollback_published_revision(uuid, bigint, text) from public, anon;
grant execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text) to authenticated;
grant execute on function public.rollback_published_revision(uuid, bigint, text) to authenticated;

-- The existing portfolio-media bucket remains PUBLIC by explicit project
-- decision. Prefix policies reinforce repository/API access boundaries;
-- Guest Runtime itself only emits references under published/*.
drop policy if exists portfolio_media_public_read on storage.objects;
drop policy if exists portfolio_media_published_anon_read on storage.objects;
drop policy if exists portfolio_media_published_authenticated_read on storage.objects;
drop policy if exists portfolio_media_admin_read on storage.objects;

create policy portfolio_media_published_anon_read on storage.objects
  for select to anon
  using (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = 'published'
  );

create policy portfolio_media_published_authenticated_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = 'published'
  );

create policy portfolio_media_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (select private.is_admin())
  );

notify pgrst, 'reload schema';
