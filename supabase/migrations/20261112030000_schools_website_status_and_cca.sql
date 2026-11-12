-- Already applied on the live project. This file only mirrors the columns.
-- cca_listed_website is not a verified campus website and must not be linked.

alter table public.schools
  add column if not exists website_status text,
  add column if not exists cca_listed_website text,
  add column if not exists cca_mccyn_tier text,
  add column if not exists cca_mccyn_listed_on date,
  add column if not exists cca_mccyn_source text;
