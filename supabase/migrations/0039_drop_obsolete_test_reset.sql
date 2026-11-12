-- Drop leftover experimental public.test_reset() function (already revoked in 0031).
drop function if exists public.test_reset();

notify pgrst, 'reload schema';

