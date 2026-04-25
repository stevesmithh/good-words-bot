-- Add explicit deny-write RLS policies on public catalog tables.
-- Writes are intentionally admin-only via service-role key in /api/admin.
-- Service role bypasses RLS, so these policies do not affect admin operations.

CREATE POLICY "No public inserts on sites"
ON public.sites FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "No public updates on sites"
ON public.sites FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No public deletes on sites"
ON public.sites FOR DELETE TO anon, authenticated USING (false);

CREATE POLICY "No public inserts on promotions"
ON public.promotions FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "No public updates on promotions"
ON public.promotions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No public deletes on promotions"
ON public.promotions FOR DELETE TO anon, authenticated USING (false);

CREATE POLICY "No public inserts on sms_providers"
ON public.sms_providers FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "No public updates on sms_providers"
ON public.sms_providers FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No public deletes on sms_providers"
ON public.sms_providers FOR DELETE TO anon, authenticated USING (false);

-- sms_short_links is internal-only, accessed exclusively via the server route
-- using the service-role key. Block all public access explicitly.
CREATE POLICY "No public access to sms_short_links"
ON public.sms_short_links FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
