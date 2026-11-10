-- Close public/authenticated execution on leftover experimental public.test_reset() RPC
-- (dropping the function requires destructive DDL confirmation in SQL Editor).
revoke all on function public.test_reset() from public, anon, authenticated;

notify pgrst, 'reload schema';

