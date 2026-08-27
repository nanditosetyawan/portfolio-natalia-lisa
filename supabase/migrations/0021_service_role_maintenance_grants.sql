-- Trusted server-side maintenance access for migration verification, fixture
-- cleanup, and disaster recovery. The service key is never shipped to Vue.

grant select, insert, update, delete on public.site_revisions to service_role;
grant select, insert, update, delete on public.editor_favorites to service_role;
grant select, insert, update, delete on public.admin_memberships to service_role;

