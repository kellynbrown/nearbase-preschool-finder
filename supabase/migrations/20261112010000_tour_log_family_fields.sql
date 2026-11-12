-- Additive family-loop fields for private tour logs.
-- Owner-only. No public view. No seed data. school_media is untouched.
-- Authenticated may read these columns because tour_logs SELECT is already
-- table-level and RLS is owner-only. INSERT and UPDATE are column grants.
-- Anon receives nothing. Reporter identity stays off openings_reports_own.

alter table public.tour_logs
  add column if not exists would_enroll text,
  add column if not exists infant_checklist jsonb not null default '{}'::jsonb,
  add column if not exists follow_ups jsonb not null default '[]'::jsonb,
  add column if not exists photo_permission text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tour_logs_would_enroll_check'
      and conrelid = 'public.tour_logs'::regclass
  ) then
    alter table public.tour_logs
      add constraint tour_logs_would_enroll_check
      check (would_enroll is null or would_enroll = any (array['yes'::text, 'maybe'::text, 'no'::text]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tour_logs_infant_checklist_check'
      and conrelid = 'public.tour_logs'::regclass
  ) then
    alter table public.tour_logs
      add constraint tour_logs_infant_checklist_check
      check (
        jsonb_typeof(infant_checklist) = 'object'
        and octet_length(infant_checklist::text) <= 8000
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tour_logs_follow_ups_check'
      and conrelid = 'public.tour_logs'::regclass
  ) then
    alter table public.tour_logs
      add constraint tour_logs_follow_ups_check
      check (
        jsonb_typeof(follow_ups) = 'array'
        and jsonb_array_length(follow_ups) <= 20
        and octet_length(follow_ups::text) <= 12000
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tour_logs_photo_permission_check'
      and conrelid = 'public.tour_logs'::regclass
  ) then
    alter table public.tour_logs
      add constraint tour_logs_photo_permission_check
      check (
        photo_permission is null
        or photo_permission = any (array[
          'not_asked'::text,
          'not_possible_during_tour_rooms_in_use'::text,
          'requested_after_hours'::text,
          'school_declined'::text,
          'written_permission_for_empty_rooms'::text
        ])
      );
  end if;
end $$;

comment on column public.tour_logs.would_enroll is
  'Owner-only yes, maybe, or no. Not a public recommendation.';
comment on column public.tour_logs.infant_checklist is
  'Owner-only infant checklist: ratio, age range, outdoor plan, language exposure, drop-off flexibility, meals. No child names.';
comment on column public.tour_logs.follow_ups is
  'Owner-only tasks with a contact role and due date. No staff names or phone numbers.';
comment on column public.tour_logs.photo_permission is
  'Owner-only note that a photo was or was not possible. Not a license to publish, and not a school_media row.';

revoke all privileges on table public.tour_logs from anon;
revoke select (
  would_enroll,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs from anon, public;

grant select (
  would_enroll,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs to authenticated;

grant insert (
  would_enroll,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs to authenticated;

grant update (
  would_enroll,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs to authenticated;

create or replace view public.openings_reports_own
with (security_invoker = true) as
select
  id,
  school_id,
  age_room,
  age_min_months,
  age_max_months,
  status,
  available_places,
  opens_on,
  waitlist_estimate,
  as_of,
  expires_at,
  source,
  public_note,
  provider_confirmed,
  moderation_status,
  created_at,
  updated_at
from public.openings_reports
where submitted_by = (select auth.uid());

comment on view public.openings_reports_own is
  'Signed-in owner''s openings reports only. No reporter id, proof, or internal notes. security_invoker so the base table RLS still applies.';

revoke all privileges on table public.openings_reports_own from public, anon, authenticated;
grant select on table public.openings_reports_own to authenticated;
