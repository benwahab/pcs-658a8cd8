-- Break the reports <-> report_media RLS dependency without weakening public media moderation.
-- SECURITY DEFINER reads the evidence rows as the function owner, avoiding recursive RLS evaluation.
create or replace function private.report_has_approved_citizen_evidence(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.report_media rm
    where rm.report_id = p_report_id
      and rm.media_role = 'citizen_evidence'
      and rm.moderation_status = 'approved'
      and (rm.media_type like 'image/%' or rm.media_type like 'video/%')
  );
$function$;

revoke all on function private.report_has_approved_citizen_evidence(uuid) from public;
grant execute on function private.report_has_approved_citizen_evidence(uuid) to anon, authenticated;

drop policy if exists reports_public_anon on public.reports;
create policy reports_public_anon
on public.reports
for select
to anon
using (
  is_public = true
  and private.report_has_approved_citizen_evidence(id)
);

drop policy if exists reports_public_read_authenticated on public.reports;
create policy reports_public_read_authenticated
on public.reports
for select
to authenticated
using (
  is_public = true
  and private.report_has_approved_citizen_evidence(id)
);
