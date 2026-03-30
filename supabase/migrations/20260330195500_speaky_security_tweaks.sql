create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "user_reports_select_related" on public.user_reports;
create policy "user_reports_select_related"
on public.user_reports
for select
to authenticated
using (auth.uid() = reporter_id or auth.uid() = reported_id);
