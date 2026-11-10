-- Align rollback_published_revision numbering with save_editor_draft and
-- publish_editor_draft (0028) using coalesce(max(revision_number), 0) + 1
-- across all site_revisions statuses under the shared advisory xact lock.

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
  next_published bigint;
  target_row public.site_revisions;
  activated_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Rollback note must be 500 characters or fewer.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('site-revisions-publish-boundary', 0)
  );

  select max(revision.revision_number)
    into current_published
  from public.site_revisions as revision
  where revision.status = 'published';

  if current_published is distinct from p_expected_published_revision then
    raise exception 'The Published revision changed before Rollback could activate.' using errcode = 'PT409';
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

  select coalesce(max(revision.revision_number), 0) + 1
    into next_published
  from public.site_revisions as revision;

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
    next_published,
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

revoke execute on function public.rollback_published_revision(uuid, bigint, text) from public, anon;
grant execute on function public.rollback_published_revision(uuid, bigint, text) to authenticated;

notify pgrst, 'reload schema';

