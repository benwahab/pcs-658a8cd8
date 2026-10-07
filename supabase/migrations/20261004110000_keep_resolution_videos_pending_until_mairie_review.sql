-- Keep resolution videos private until the responsible mairie approves them.
-- Citizen video moderation remains unchanged.
create or replace function public.prepare_report_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.media_role = 'citizen_evidence' and new.media_type like 'video/%' then
    new.moderation_status := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  elsif new.media_role = 'resolution_video' then
    new.moderation_status := 'pending';
    new.moderated_at := null;
    new.moderated_by := null;
    new.moderation_reason := null;
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$function$;
