grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.match_preferences to authenticated;
grant select on table public.subscription_state to authenticated;
grant select on table public.user_reports to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.match_preferences to service_role;
grant all privileges on table public.user_reports to service_role;
grant all privileges on table public.subscription_state to service_role;
