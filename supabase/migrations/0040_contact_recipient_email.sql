-- 0040_contact_recipient_email.sql
-- Add configurable recipient email column to contact_profiles
-- so admin can specify Lisa's email address for optional guest mailto dispatch.

alter table public.contact_profiles
  add column if not exists recipient_email text not null default '';

alter table public.contact_profiles
  drop constraint if exists contact_profiles_recipient_email_check;

alter table public.contact_profiles
  add constraint contact_profiles_recipient_email_check
  check (
    recipient_email = ''
    or (
      char_length(recipient_email) <= 320
      and recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  );

notify pgrst, 'reload schema';

