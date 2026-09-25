create or replace view public.public_report_status_history as
select h.id,h.report_id,h.old_status,h.new_status,null::text as reason,h.created_at
from public.report_status_history h join public.reports r on r.id=h.report_id where r.is_public=true;
grant select on public.public_report_status_history to anon, authenticated;
