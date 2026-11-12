-- Follow-up to tour_log_family_fields. Supabase default privileges granted
-- authenticated insert and update on the new view. This leaves SELECT only.
revoke all privileges on table public.openings_reports_own from public, anon, authenticated;
grant select on table public.openings_reports_own to authenticated;
