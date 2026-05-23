DROP POLICY IF EXISTS "Providers are viewable by everyone" ON public.sms_providers;

CREATE POLICY "No public reads on sms_providers"
ON public.sms_providers
FOR SELECT
TO anon, authenticated
USING (false);