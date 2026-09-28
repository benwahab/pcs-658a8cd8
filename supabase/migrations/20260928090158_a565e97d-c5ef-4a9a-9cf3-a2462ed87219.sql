GRANT SELECT ON public.regions TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.communes TO anon, authenticated;
DROP POLICY IF EXISTS regions_public_read ON public.regions;
CREATE POLICY regions_public_read ON public.regions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon USING (is_active);