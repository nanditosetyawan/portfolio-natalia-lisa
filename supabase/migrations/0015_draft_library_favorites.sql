-- Phase 029F-R2: owned draft library, atomic draft writes, and favorite relations.

drop policy if exists "Admins can read site revisions" on public.site_revisions;
drop policy if exists "Admins can update site revisions" on public.site_revisions;

create policy "Admins can read site revisions"
  on public.site_revisions for select to authenticated
  using ((select private.is_admin()) and (status = 'published' or created_by = (select auth.uid())));

create policy "Admins can update own draft revisions"
  on public.site_revisions for update to authenticated
  using ((select private.is_admin()) and status = 'draft' and created_by = (select auth.uid()))
  with check ((select private.is_admin()) and status = 'draft' and created_by = (select auth.uid()));

create policy "Admins can delete own draft revisions"
  on public.site_revisions for delete to authenticated
  using ((select private.is_admin()) and status = 'draft' and created_by = (select auth.uid()));

grant delete on public.site_revisions to authenticated;

create or replace function public.enforce_editor_draft_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'draft' then
    perform pg_advisory_xact_lock(hashtextextended('site-revisions-publish-boundary', 0));
    if (select count(*) from public.site_revisions where status = 'draft' and created_by = new.created_by) >= 10 then
      raise exception 'Maximum 10 drafts reached. Delete an existing draft before creating a new one.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_editor_draft_limit on public.site_revisions;
create trigger enforce_editor_draft_limit
  before insert on public.site_revisions
  for each row execute function public.enforce_editor_draft_limit();

create table if not exists public.editor_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_id uuid not null references public.site_revisions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, revision_id)
);

create index if not exists editor_favorites_user_created_idx
  on public.editor_favorites (user_id, created_at desc);

create index if not exists editor_favorites_revision_idx
  on public.editor_favorites (revision_id);

alter table public.editor_favorites enable row level security;

create policy "Admins can read own editor favorites"
  on public.editor_favorites for select to authenticated
  using ((select private.is_admin()) and user_id = (select auth.uid()));

create policy "Admins can create own editor favorites"
  on public.editor_favorites for insert to authenticated
  with check ((select private.is_admin()) and user_id = (select auth.uid()));

create policy "Admins can delete own editor favorites"
  on public.editor_favorites for delete to authenticated
  using ((select private.is_admin()) and user_id = (select auth.uid()));

grant select, insert, delete on public.editor_favorites to authenticated;

create or replace function public.enforce_editor_favorite_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('editor-favorites:' || new.user_id::text, 0));
  if (select count(*) from public.editor_favorites where user_id = new.user_id) >= 8 then
    raise exception 'Maximum 8 favorites reached.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_editor_favorite_limit on public.editor_favorites;
create trigger enforce_editor_favorite_limit
  before insert on public.editor_favorites
  for each row execute function public.enforce_editor_favorite_limit();

create or replace function public.save_editor_draft(
  p_draft_id uuid,
  p_snapshot jsonb,
  p_expected_base_revision bigint,
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
begin
  if not (select private.is_admin()) then raise exception 'Admin access required'; end if;
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
    select * into existing from public.site_revisions
      where id = p_draft_id and status = 'draft' and created_by = (select auth.uid())
      for update;
    if not found then raise exception 'Draft revision was not found.'; end if;
    update public.site_revisions
      set snapshot = p_snapshot, base_revision_number = p_expected_base_revision, updated_at = now()
      where id = existing.id;
  else
    if not p_create_new then raise exception 'A new draft must explicitly request creation.'; end if;
    if (select count(*) from public.site_revisions where status = 'draft' and created_by = (select auth.uid())) >= 10 then
      raise exception 'Maximum 10 drafts reached. Delete an existing draft before creating a new one.';
    end if;
    select coalesce(max(revision_number), 0) + 1 into new_revision from public.site_revisions;
    insert into public.site_revisions (revision_number, status, snapshot, base_revision_number, created_by)
      values (new_revision, 'draft', p_snapshot, p_expected_base_revision, (select auth.uid()));
  end if;
  return query select * from public.site_revisions where id = coalesce(p_draft_id, (select id from public.site_revisions where status = 'draft' and created_by = (select auth.uid()) order by created_at desc limit 1));
end;
$$;

create or replace function public.discard_editor_draft(p_draft_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not (select private.is_admin()) then raise exception 'Admin access required'; end if;
  delete from public.site_revisions where id = p_draft_id and status = 'draft' and created_by = (select auth.uid());
end;
$$;

create or replace function public.add_editor_favorite(p_revision_id uuid)
returns public.editor_favorites
language plpgsql
set search_path = public
as $$
declare
  result public.editor_favorites;
begin
  if not (select private.is_admin()) then raise exception 'Admin access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('editor-favorites:' || (select auth.uid())::text, 0));
  if not exists (select 1 from public.site_revisions where id = p_revision_id and status = 'draft' and created_by = (select auth.uid())) then
    raise exception 'Draft revision was not found.';
  end if;
  select * into result from public.editor_favorites where user_id = (select auth.uid()) and revision_id = p_revision_id;
  if found then return result; end if;
  if (select count(*) from public.editor_favorites where user_id = (select auth.uid())) >= 8 then
    raise exception 'Maximum 8 favorites reached.';
  end if;
  insert into public.editor_favorites (user_id, revision_id) values ((select auth.uid()), p_revision_id) returning * into result;
  return result;
end;
$$;

create or replace function public.remove_editor_favorite(p_revision_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.editor_favorites where user_id = (select auth.uid()) and revision_id = p_revision_id;
$$;

revoke execute on function public.save_editor_draft(uuid, jsonb, bigint, boolean) from public, anon;
revoke execute on function public.discard_editor_draft(uuid) from public, anon;
revoke execute on function public.add_editor_favorite(uuid) from public, anon;
revoke execute on function public.remove_editor_favorite(uuid) from public, anon;

grant execute on function public.save_editor_draft(uuid, jsonb, bigint, boolean) to authenticated;
grant execute on function public.discard_editor_draft(uuid) to authenticated;
grant execute on function public.add_editor_favorite(uuid) to authenticated;
grant execute on function public.remove_editor_favorite(uuid) to authenticated;
