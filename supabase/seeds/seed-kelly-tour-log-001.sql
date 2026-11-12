-- PRIVATE seed for Kelly's 11 Nov 2026 Community Montessori School tour.
-- DO NOT RUN until Kelly confirms (1) the exact campus and a public.schools.id for it,
-- and (2) that the single auth user/profile in project ipwvweqqzvozuvgkwxpm is his.
-- This file does not insert a school and does not use Parkside Community Montessori
-- (ncr-va-vdoe-5115, Sterling), which is a different campus.
-- Community Montessori School, likely 1700 Reston Parkway, Reston VA (cmsreston.com),
-- was not on the official VQB5 participation list dated 11.01.2026, so it has not
-- been added under the current MCCYN-eligible policy.
-- share_publicly is false. No staff names, child names, or phone numbers are stored.

-- Replace these two placeholders after confirmation:
--   :school_id  text PK in public.schools
--   :user_id    uuid of Kelly's auth.users / profiles row

INSERT INTO public.tour_logs (
  user_id,
  school_id,
  visited_on,
  rating,
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
  moderation_status
) VALUES (
  :user_id,
  :school_id,
  DATE '2026-11-11',
  4,
  ARRAY[
    'Happy, robust social atmosphere with other infants',
    'Dedicated outdoor time, space, and plan for infants and older ages',
    'Safe, simple infant room'
  ],
  ARRAY[
    'Little spoken language observed in the infant room',
    'Concern about language development / language-rich practices'
  ],
  '[
    {
      "room_label": "Infant",
      "age_min_months": 3,
      "age_max_months": 18,
      "places": null,
      "earliest_start": "2027-05-15",
      "waitlist": "not_asked",
      "observed_on": "2026-11-11",
      "source_role": "tour; business owner returning in a couple of days",
      "ratio": "up to 15 infants with 3 dedicated adults (1:5)",
      "notes": "Enrollment fluctuates; circle back on mid-May 2027 availability"
    }
  ]'::jsonb,
  'not_asked — call business manager; business owner back in a couple of days. Enrollment fluctuates; re-check mid-May 2027 start.',
  NULL,
  NULL,
  'USD',
  '{
    "cost_status": "pending",
    "cost_document": "Kelly photographing a cost breakdown; keep any upload private",
    "meals": "optional",
    "dropoff": "flexible drop-off/pick-up; exterior-facing classroom doors"
  }'::jsonb,
  'Tour led by the most senior teacher. Staff and children were warm and very happy. Keep identifiable staff details private.',
  $notes$
Gut rating 4/5. Would enroll: YES.
Program: dedicated infant room 3–18 months; earliest age accepted 3 months; target start mid-May 2027 (baby due Feb 2027).
Facility: 6 classrooms, plain, windows with natural light. No photos possible (all rooms in use). After-hours photo request needed before any NearBase publication, and only with written school permission; empty rooms / no identifiable children.
Follow-ups:
1) Call business manager about openings/waitlist for a mid-May 2027 start; due after the business owner returns (a couple of days from 11 Nov 2026).
2) Ask about language-rich practices in the infant room (narration, songs, reading, English exposure).
3) Get the cost breakdown; store any photographed cost sheet privately, not in school_media.
Infant checklist: ratio 1:5 (3 adults / up to 15 infants); age range 3–18 months; outdoor plan dedicated for infants; language exposure is a concern; drop-off flexibility yes; meals optional.
$notes$,
  '{
    "would_enroll": "yes",
    "photo_permission": "not_possible_during_tour_rooms_in_use",
    "after_hours_photo_request": true,
    "infant_checklist": {
      "ratio": "1:5 (3 adults / up to 15 infants)",
      "age_range": "3-18 months, earliest accepted 3 months",
      "outdoor_plan_for_infants": "dedicated outdoor time/space/plan",
      "language_exposure": "concern — little spoken language observed; follow up on narration, songs, reading, English exposure",
      "dropoff_flexibility": "flexible drop-off/pick-up; exterior-facing classroom doors",
      "meals": "optional"
    },
    "follow_ups": [
      {"task": "Call business manager about openings/waitlist for mid-May 2027 start", "contact_role": "business manager", "due": "after business owner returns, a couple of days after 2026-11-11", "status": "open"},
      {"task": "Ask about language-rich practices in the infant room", "status": "open"},
      {"task": "Obtain cost breakdown; keep document private", "status": "open"}
    ]
  }'::jsonb,
  false,
  NULL,
  'pending'
);
