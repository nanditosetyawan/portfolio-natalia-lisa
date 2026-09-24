alter table public.site_revisions
  drop constraint if exists site_revisions_source_draft_revision_id_fkey,
  add constraint site_revisions_source_draft_revision_id_fkey
    foreign key (source_draft_revision_id)
    references public.site_revisions(id)
    on delete set null;

alter table public.site_revisions
  drop constraint if exists site_revisions_published_metadata_check,
  add constraint site_revisions_published_metadata_check check (
    status <> 'published'
    or (
      published_at is not null
      and published_by is not null
      and publication_kind is not null
      and (
        (publication_kind = 'publish' and rollback_source_revision_id is null)
        or (publication_kind = 'rollback' and rollback_source_revision_id is not null)
      )
    )
  );
