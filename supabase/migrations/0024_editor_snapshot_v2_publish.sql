-- Release candidate: accept the backward-compatible EditorSnapshot v1/v2
-- contract at the existing atomic Publish boundary. Snapshot v2 adds canonical
-- dynamic image instances; all other Publish, media, and revision semantics
-- remain unchanged.

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
  global_max bigint;
  draft_row public.site_revisions;
  next_published bigint;
  activated_id uuid;
  draft_media_shape jsonb;
  prepared_media_shape jsonb;
  snapshot_schema_version integer;
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
    raise exception 'The Published revision changed while this Draft was being prepared.' using errcode = 'PT409';
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
    raise exception 'The Draft changed while Publish was being prepared.' using errcode = 'PT409';
  end if;

  if draft_row.base_revision_number is distinct from current_published then
    raise exception 'This Draft is based on an older Published revision.' using errcode = 'PT409';
  end if;

  if jsonb_typeof(p_prepared_snapshot) is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'compatibility') is distinct from 'object'
     or coalesce(p_prepared_snapshot #>> '{compatibility,schemaVersion}', '') not in ('1', '2')
     or jsonb_typeof(p_prepared_snapshot -> 'content') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'entities') is distinct from 'array'
     or jsonb_typeof(p_prepared_snapshot -> 'typography') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'layout') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'media') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot #> '{media,references}') is distinct from 'array'
     or jsonb_typeof(p_prepared_snapshot #> '{media,assignments}') is distinct from 'array'
     or jsonb_typeof(p_prepared_snapshot #> '{media,styles}') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'backgrounds') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'buttons') is distinct from 'object'
     or jsonb_typeof(p_prepared_snapshot -> 'animations') is distinct from 'object' then
    raise exception 'Published Snapshot structure is invalid.';
  end if;

  snapshot_schema_version := (p_prepared_snapshot #>> '{compatibility,schemaVersion}')::integer;

  -- A v1 document cannot carry v2-only instances. A v2 document must provide
  -- the canonical collection, including an empty array when it has no dynamic
  -- objects. This keeps old revisions readable without silently reinterpreting
  -- their shape.
  if snapshot_schema_version = 1 then
    if p_prepared_snapshot ? 'instances'
       and (
         jsonb_typeof(p_prepared_snapshot -> 'instances') is distinct from 'array'
         or jsonb_array_length(p_prepared_snapshot -> 'instances') <> 0
       ) then
      raise exception 'EditorSnapshot v1 cannot contain dynamic instances.';
    end if;
  elsif jsonb_typeof(p_prepared_snapshot -> 'instances') is distinct from 'array' then
    raise exception 'EditorSnapshot v2 requires an instances array.';
  end if;

  if snapshot_schema_version = 2 then
    if jsonb_array_length(p_prepared_snapshot -> 'instances') > 500 then
      raise exception 'EditorSnapshot exceeds the maximum of 500 dynamic instances.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      where jsonb_typeof(instance.value) is distinct from 'object'
         or coalesce(instance.value ->> 'instanceId', '') !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
         or instance.value ->> 'type' <> 'image'
         or coalesce(instance.value ->> 'sectionId', '') !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
         or btrim(coalesce(instance.value ->> 'label', '')) = ''
         or char_length(coalesce(instance.value ->> 'label', '')) > 128
         or jsonb_typeof(instance.value -> 'order') is distinct from 'number'
         or coalesce(instance.value ->> 'order', '') !~ '^[0-9]+$'
         or (instance.value ->> 'order')::numeric < 0
         or (instance.value ->> 'order')::numeric > 100000
         or btrim(coalesce(instance.value ->> 'createdAt', '')) = ''
         or char_length(coalesce(instance.value ->> 'createdAt', '')) > 64
         or jsonb_typeof(instance.value -> 'source') is distinct from 'object'
         or instance.value #>> '{source,kind}' <> 'media-assignment'
         or instance.value #>> '{source,assignmentEntityId}' is distinct from instance.value ->> 'instanceId'
    ) then
      raise exception 'EditorSnapshot contains an invalid dynamic instance.';
    end if;

    if (
      select count(*)
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
    ) <> (
      select count(distinct instance.value ->> 'instanceId')
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
    ) or exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      join jsonb_array_elements(p_prepared_snapshot -> 'entities') as entity(value)
        on entity.value ->> 'entityId' = instance.value ->> 'instanceId'
    ) then
      raise exception 'Dynamic instance IDs must be unique and must not collide with fixed objects.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      where not exists (
        select 1
        from jsonb_array_elements(p_prepared_snapshot -> 'entities') as entity(value)
        where trim(both '-' from regexp_replace(lower(btrim(entity.value ->> 'section')), '[^a-z0-9]+', '-', 'g'))
          = instance.value ->> 'sectionId'
      )
    ) then
      raise exception 'Dynamic instance references an unknown section.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      group by instance.value ->> 'sectionId'
      having count(*) > 100
    ) then
      raise exception 'A section exceeds the maximum of 100 dynamic instances.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      group by instance.value ->> 'sectionId', instance.value ->> 'order'
      having count(*) > 1
    ) then
      raise exception 'Dynamic instance order must be unique within its section.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_prepared_snapshot -> 'instances') as instance(value)
      where (
        select count(*)
        from jsonb_array_elements(p_prepared_snapshot #> '{media,assignments}') as assignment(value)
        where assignment.value ->> 'entityId' = instance.value ->> 'instanceId'
          and assignment.value ->> 'role' = 'dynamic-image'
          and btrim(coalesce(assignment.value ->> 'assetId', '')) <> ''
      ) <> 1
      or not exists (
        select 1
        from jsonb_array_elements(p_prepared_snapshot #> '{media,assignments}') as assignment(value)
        join jsonb_array_elements(p_prepared_snapshot #> '{media,references}') as media_ref(value)
          on media_ref.value ->> 'assetId' = assignment.value ->> 'assetId'
        where assignment.value ->> 'entityId' = instance.value ->> 'instanceId'
      )
      or jsonb_typeof(p_prepared_snapshot #> array['layout', instance.value ->> 'instanceId']) is distinct from 'object'
      or p_prepared_snapshot #>> array['layout', instance.value ->> 'instanceId', 'positionMode'] <> 'absolute'
      or p_prepared_snapshot #> array['layout', instance.value ->> 'instanceId', 'width'] is null
      or p_prepared_snapshot #> array['layout', instance.value ->> 'instanceId', 'height'] is null
      or jsonb_typeof(p_prepared_snapshot #> array['media', 'styles', instance.value ->> 'instanceId']) is distinct from 'object'
    ) then
      raise exception 'Dynamic instance is missing its media, layout, or style record.';
    end if;
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

  select coalesce(max(revision.revision_number), 0)
  into global_max
  from public.site_revisions as revision;

  next_published := global_max + 1;

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

revoke execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text) from public, anon;
grant execute on function public.publish_editor_draft(uuid, jsonb, bigint, bigint, text) to authenticated;

notify pgrst, 'reload schema';
