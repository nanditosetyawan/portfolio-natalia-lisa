-- Phase 029F-R3: atomic compare-and-write token for an existing Draft row.
-- The stable Draft identity and revision_number remain unchanged on save.

alter table public.site_revisions
  add column if not exists lock_version bigint not null default 1
  check (lock_version > 0);

drop function if exists public.save_editor_draft(uuid, jsonb, bigint, boolean);

create or replace function public.save_editor_draft(
  p_draft_id uuid,
  p_snapshot jsonb,
  p_expected_base_revision bigint,
  p_expected_lock_version bigint default null,
  p_create_new boolean default false
)
returns setof public.site_revisions
language plpgsql
set search_path = public
as $$
declare
  current_published bigint;
  existing public.site_revisions;
  new_revision bigint;
  saved_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('site-revisions-publish-boundary', 0));

  select revision_number into current_published
    from public.site_revisions
    where status = 'published'
    order by revision_number desc
    limit 1;

  if current_published is distinct from p_expected_base_revision then
    raise exception 'The draft is based on an older published revision.' using errcode = '40001';
  end if;

  if p_draft_id is not null then
    select * into existing
      from public.site_revisions
      where id = p_draft_id
        and status = 'draft'
        and created_by = (select auth.uid())
      for update;

    if not found then
      raise exception 'Draft revision was not found.';
    end if;

    if p_expected_lock_version is null or existing.lock_version <> p_expected_lock_version then
      raise exception 'The Draft changed since it was loaded. Reload the latest Draft.' using errcode = '40001';
    end if;

    update public.site_revisions
      set snapshot = p_snapshot,
          base_revision_number = p_expected_base_revision,
          lock_version = existing.lock_version + 1,
          updated_at = now()
      where id = existing.id
      returning id into saved_id;
  else
    if not p_create_new then
      raise exception 'A new draft must explicitly request creation.';
    end if;

    if (select count(*) from public.site_revisions where status = 'draft' and created_by = (select auth.uid())) >= 10 then
      raise exception 'Maximum 10 drafts reached. Delete an existing draft before creating a new one.';
    end if;

    select coalesce(max(revision_number), 0) + 1 into new_revision from public.site_revisions;
    insert into public.site_revisions (revision_number, lock_version, status, snapshot, base_revision_number, created_by)
      values (new_revision, 1, 'draft', p_snapshot, p_expected_base_revision, (select auth.uid()))
      returning id into saved_id;
  end if;

  return query select * from public.site_revisions where id = saved_id;
end;
$$;

revoke execute on function public.save_editor_draft(uuid, jsonb, bigint, bigint, boolean) from public, anon;
grant execute on function public.save_editor_draft(uuid, jsonb, bigint, bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
