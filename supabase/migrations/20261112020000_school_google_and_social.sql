-- Public school fields for a Google place id and official social links.
-- Nullable. No photo bytes, photo URIs, or scraped images are stored.
-- Existing schools SELECT policy still applies. This does not grant a new write.

alter table public.schools
  add column if not exists google_place_id text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schools_google_place_id_check'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_google_place_id_check
      check (google_place_id is null or google_place_id ~ '^[A-Za-z0-9_-]{8,255}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'schools_instagram_url_check'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_instagram_url_check
      check (
        instagram_url is null
        or (
          length(instagram_url) <= 500
          and instagram_url ~ '^https://(www\.)?instagram\.com/[^[:space:]@]+$'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'schools_facebook_url_check'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_facebook_url_check
      check (
        facebook_url is null
        or (
          length(facebook_url) <= 500
          and facebook_url ~ '^https://((www|m)\.)?facebook\.com/[^[:space:]@]+$'
        )
      );
  end if;
end $$;

comment on column public.schools.google_place_id is
  'Google place id only. Do not store Place photo URIs, image bytes, or altered imagery.';
comment on column public.schools.instagram_url is
  'Official Instagram HTTPS URL. Profiles may embed a post or reel. They do not copy images.';
comment on column public.schools.facebook_url is
  'Official Facebook HTTPS URL. Profiles may use Facebook''s plugin. They do not copy images.';
