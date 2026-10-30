-- Fix PCS institutional logo storage authorization and least-privilege table updates.
-- The storage object path is:
--   mairie/{mairie_id}/{filename}
--   organization/{organization_id}/{filename}

drop policy if exists organization_logos_authorized_upload on storage.objects;
create policy organization_logos_authorized_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and (
    (
      (storage.foldername(objects.name))[1] = 'mairie'
      and exists (
        select 1
        from public.mairies m
        where m.id::text = (storage.foldername(objects.name))[2]
          and m.account_user_id = (select auth.uid())
          and m.is_active = true
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] = 'organization'
      and exists (
        select 1
        from public.organization_users ou
        where ou.organization_id::text = (storage.foldername(objects.name))[2]
          and ou.user_id = (select auth.uid())
          and ou.is_active = true
          and ou.role = 'admin'
      )
    )
  )
);

drop policy if exists organization_logos_authorized_delete on storage.objects;
create policy organization_logos_authorized_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-logos'
  and (
    (
      (storage.foldername(objects.name))[1] = 'mairie'
      and exists (
        select 1
        from public.mairies m
        where m.id::text = (storage.foldername(objects.name))[2]
          and m.account_user_id = (select auth.uid())
          and m.is_active = true
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] = 'organization'
      and exists (
        select 1
        from public.organization_users ou
        where ou.organization_id::text = (storage.foldername(objects.name))[2]
          and ou.user_id = (select auth.uid())
          and ou.is_active = true
          and ou.role = 'admin'
      )
    )
  )
);

-- Remove broad direct UPDATE access from public client roles.
-- Mairie profile editing already uses mayor_name; keep that existing capability
-- while limiting direct updates to the two intended mairie profile fields.
revoke update on table public.organizations from anon, authenticated;
grant update (logo_url) on table public.organizations to authenticated;

revoke update on table public.mairies from anon, authenticated;
grant update (logo_url, mayor_name) on table public.mairies to authenticated;
