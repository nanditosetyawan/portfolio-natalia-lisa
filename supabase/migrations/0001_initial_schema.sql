create schema if not exists private;

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_profile (
  id text primary key,
  title text not null,
  name text not null,
  media_usage_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.about_sections (
  id text primary key,
  title text not null,
  cta_id text,
  cta_text text,
  cta_target_section_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.about_paragraphs (
  id text primary key,
  about_section_id text not null references public.about_sections(id) on delete cascade,
  body text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.education_sections (
  id text primary key,
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.college_entries (
  id text primary key,
  school text not null,
  period text not null,
  description text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shs_entries (
  id text primary key,
  school text not null,
  period text not null,
  description text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiences (
  id text primary key,
  title text not null,
  date text not null,
  description text not null,
  frame_id text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificate_sections (
  id text primary key,
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificates (
  id text primary key,
  title text not null,
  date text not null,
  description text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_profiles (
  id text primary key,
  line1 text not null,
  line2 text not null,
  cta_id text,
  cta_text text,
  cta_href text,
  person_media_usage_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.navigation_items (
  id text primary key,
  item_key text not null unique,
  label text not null,
  target_section_id text not null,
  offset_mode text not null check (offset_mode in ('fixed', 'align-bottom')),
  offset_value integer not null default 0,
  order_index integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id text primary key,
  storage_bucket text,
  storage_path text,
  mime_type text not null default '',
  file_size bigint,
  width integer,
  height integer,
  alt_text text not null default '',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_size is null or file_size >= 0),
  check (width is null or width > 0),
  check (height is null or height > 0)
);

create table public.entity_media (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  role text not null,
  media_asset_id text not null references public.media_assets(id) on delete restrict,
  object_position text not null default '50% 50%',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id, role)
);

create table public.photo_frames (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  role text not null,
  media_asset_id text references public.media_assets(id) on delete set null,
  visual_config jsonb not null default '{}'::jsonb,
  placeholder_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id, role)
);

create table public.certificate_images (
  id text primary key,
  certificate_id text not null references public.certificates(id) on delete cascade,
  role text not null check (role in ('thumbnail', 'detail')),
  order_index integer not null default 0,
  media_asset_id text references public.media_assets(id) on delete set null,
  object_position text not null default 'center center',
  placeholder_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (certificate_id, role, order_index)
);

create table public.entity_visual_configs (
  entity_type text not null,
  entity_id text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_memberships', 'portfolio_profile', 'about_sections', 'about_paragraphs',
    'education_sections', 'college_entries', 'shs_entries', 'experiences',
    'certificate_sections', 'certificates', 'contact_profiles', 'navigation_items',
    'media_assets', 'entity_media', 'photo_frames', 'certificate_images',
    'entity_visual_configs'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', 'touch_' || table_name, table_name);
  end loop;
end $$;
