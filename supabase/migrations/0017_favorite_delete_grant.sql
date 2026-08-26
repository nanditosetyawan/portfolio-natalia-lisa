-- Phase 029F-R3: the security-invoker remove RPC needs the same DELETE grant
-- as the authenticated Admin RLS policy it executes through.

grant delete on public.editor_favorites to authenticated;

notify pgrst, 'reload schema';
