-- Authenticated clients need to verify the current user's admin membership.
-- RLS still permits rows only to an authorized admin; this grant does not authorize writes.
grant select on table public.admin_memberships to authenticated;
