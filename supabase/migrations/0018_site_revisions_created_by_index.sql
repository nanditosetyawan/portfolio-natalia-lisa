-- Phase 029F-R3: cover the auth.users foreign key and Admin Draft listing path.

create index if not exists site_revisions_created_by_status_updated_idx
  on public.site_revisions (created_by, status, updated_at desc);
