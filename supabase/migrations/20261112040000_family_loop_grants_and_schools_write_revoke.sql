-- Family-loop write grants and a schools write revoke.
-- Do not run this from the app. Apply it in the Supabase SQL editor.
-- INSERT and UPDATE stay column-scoped so a signed-in family cannot set
-- moderation, permission, or proof columns. RLS still limits rows to the owner
-- (or, for openings and media, to a pending insert). SELECT and DELETE are
-- table-level where the existing policies already allow only the owner's rows.
-- Table-level INSERT on tour_logs is intentionally not granted: there is no
-- WITH CHECK that forces moderation_status back to pending.

grant select, delete on table public.tour_logs to authenticated;

grant insert (
  user_id,
  school_id,
  visited_on,
  rating,
  would_enroll,
  likes,
  dislikes,
  openings_by_age_room,
  waitlist,
  quoted_cost,
  quoted_cost_period,
  quoted_cost_currency,
  fees_and_inclusions,
  staff_interaction_notes,
  notes,
  search_preference_changes,
  share_publicly,
  public_summary_draft,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs to authenticated;

grant update (
  school_id,
  visited_on,
  rating,
  would_enroll,
  likes,
  dislikes,
  openings_by_age_room,
  waitlist,
  quoted_cost,
  quoted_cost_period,
  quoted_cost_currency,
  fees_and_inclusions,
  staff_interaction_notes,
  notes,
  search_preference_changes,
  share_publicly,
  public_summary_draft,
  infant_checklist,
  follow_ups,
  photo_permission
) on table public.tour_logs to authenticated;

grant select, delete on table public.user_preferences to authenticated;

grant insert (
  user_id,
  preferred_installations,
  preferred_jurisdictions,
  age_room_interests,
  must_haves,
  deal_breakers,
  visual_interests,
  budget_max,
  budget_period,
  max_commute_minutes,
  preferred_start_month,
  care_schedule,
  preference_weights,
  apply_tour_learning
) on table public.user_preferences to authenticated;

grant update (
  preferred_installations,
  preferred_jurisdictions,
  age_room_interests,
  must_haves,
  deal_breakers,
  visual_interests,
  budget_max,
  budget_period,
  max_commute_minutes,
  preferred_start_month,
  care_schedule,
  preference_weights,
  apply_tour_learning
) on table public.user_preferences to authenticated;

-- openings_reports and school_media stay column-scoped for SELECT. A table-level
-- SELECT would expose reporter identity, internal notes, and permission proof
-- on rows the public-read policy already allows signed-in users to see.
grant delete on table public.openings_reports to authenticated;

grant insert (
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
  source_url,
  public_note,
  adult_attested,
  permission_evidence
) on table public.openings_reports to authenticated;

grant update (
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
  source_url,
  public_note,
  adult_attested,
  permission_evidence
) on table public.openings_reports to authenticated;

grant delete on table public.school_media to authenticated;

grant insert (
  school_id,
  media_type,
  url,
  storage_bucket,
  storage_path,
  external_provider,
  source,
  source_url,
  caption,
  alt_text,
  credit,
  captured_on,
  sort_order,
  adult_attested,
  permission_evidence,
  contains_identifiable_children,
  contains_identifiable_adults,
  consent_evidence_ref,
  faces_blurred
) on table public.school_media to authenticated;

grant update (
  school_id,
  media_type,
  url,
  storage_bucket,
  storage_path,
  external_provider,
  source,
  source_url,
  caption,
  alt_text,
  credit,
  captured_on,
  sort_order,
  adult_attested,
  permission_evidence,
  contains_identifiable_children,
  contains_identifiable_adults,
  consent_evidence_ref,
  faces_blurred
) on table public.school_media to authenticated;

revoke insert, update, delete, truncate on table public.schools from anon, authenticated;
